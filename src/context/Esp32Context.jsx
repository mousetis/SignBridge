import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Esp32Client } from '../lib/esp32/client.js';
import { JoystickFilter, PressureGestureDetector } from '../lib/esp32/filters.js';
import { CursorController } from '../lib/esp32/cursorController.js';
import { normalizeWsUrl } from '../lib/esp32/protocol.js';
import { useSettings } from './SettingsContext.jsx';
import { useToast } from './ToastContext.jsx';
import { useT } from '../i18n/index.jsx';

const Ctx = createContext(null);

export function Esp32Provider({ children }) {
  const { settings, patch } = useSettings();
  const { notify } = useToast();
  const { t } = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const clientRef = useRef(null);
  const cursorRef = useRef(null);
  if (!clientRef.current) clientRef.current = new Esp32Client();
  if (!cursorRef.current) cursorRef.current = new CursorController();
  const client = clientRef.current;
  const cursor = cursorRef.current;

  const filter = useRef(new JoystickFilter({ deadzone: settings.joystick.deadzone, window: 5 }));
  const pressure = useRef(new PressureGestureDetector(settings.pressure));
  const eventsSeen = useRef(false);
  const dragFromHold = useRef(false);
  const holdLowSince = useRef(0);
  const gestureListeners = useRef(new Set());
  // Dữ liệu thời gian thực: không dùng state để tránh render 50 lần/giây.
  const tel = useRef({ x: 0, y: 0, fx: 0, fy: 0, kpa: 0, event: null, eventAt: 0, at: 0 });
  const [snap, setSnap] = useState(client.snapshot());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** Đăng ký nhận sự kiện cử chỉ (LEFT_CLICK, RIGHT_CLICK…) – dùng cho chế độ quét và hiệu chỉnh hơi thở. */
  const onGesture = useCallback((fn) => {
    gestureListeners.current.add(fn);
    return () => gestureListeners.current.delete(fn);
  }, []);

  const handleEvent = useCallback((ev) => {
    let e = ev;
    if (e === 'HOLD_DRAG') {
      e = cursor.dragging ? 'DRAG_END' : 'DRAG_START';
      dragFromHold.current = e === 'DRAG_START';
    } else if (e === 'DRAG_END') dragFromHold.current = false;
    tel.current.event = e;
    tel.current.eventAt = performance.now();
    gestureListeners.current.forEach((fn) => fn(e));
    if (!settingsRef.current.scan.enabled) cursor.perform(e);
  }, [cursor]);

  const pushConfig = useCallback(() => {
    const s = settingsRef.current;
    client.sendConfig({
      joystick: { deadzone: s.joystick.deadzone, cursor_speed: s.joystick.cursorSpeed },
      pressure: {
        puff_left_click_kpa: s.pressure.puff,
        sip_right_click_kpa: s.pressure.sip,
        double_puff_window_ms: s.pressure.doubleMs,
        hold_drag_duration_ms: s.pressure.holdMs,
      },
    });
  }, [client]);

  // Kết nối & nhận dữ liệu
  useEffect(() => {
    const offState = client.on('state', setSnap);
    const offTel = client.on('telemetry', (m) => {
      const now = performance.now();
      const T = tel.current;
      T.x = m.x ?? 0;
      T.y = m.y ?? 0;
      if (m.kpa !== null) T.kpa = m.kpa;
      T.at = now;
      const f = filter.current.push(T.x, T.y);
      T.fx = f.x;
      T.fy = f.y;
      cursor.setVector(f.x, f.y);
      if (m.hasEventField) eventsSeen.current = true;
      if (m.event) handleEvent(m.event);
      else if (!eventsSeen.current && m.kpa !== null) {
        for (const ev of pressure.current.update(m.kpa, now)) handleEvent(ev);
      }
      // Firmware chỉ gửi HOLD_DRAG một lần: tự kết thúc kéo khi hơi thở nhả
      if (dragFromHold.current && cursor.dragging && m.kpa !== null) {
        if (m.kpa < settingsRef.current.pressure.puff * 0.5) {
          if (!holdLowSince.current) holdLowSince.current = now;
          else if (now - holdLowSince.current > 120) {
            holdLowSince.current = 0;
            handleEvent('DRAG_END');
          }
        } else holdLowSince.current = 0;
      }
    });
    const offOpen = client.on('open', () => {
      filter.current.reset();
      pressure.current.reset();
      eventsSeen.current = false;
      notify(tRef.current('esp.connectedToast'), 'ok');
      pushConfig();
    });
    return () => {
      offState();
      offTel();
      offOpen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Cập nhật thông số cục bộ + gửi xuống ESP32 (debounce) khi người dùng đổi thanh trượt
  useEffect(() => {
    filter.current.setDeadzone(settings.joystick.deadzone);
    pressure.current.setConfig(settings.pressure);
    cursor.configure({
      speed: settings.joystick.cursorSpeed,
      invertX: settings.joystick.invertX,
      invertY: settings.joystick.invertY,
      enabled: settings.joystick.cursorEnabled && !settings.scan.enabled,
    });
    if (client.state !== 'connected') return undefined;
    const tm = setTimeout(pushConfig, 200);
    return () => clearTimeout(tm);
  }, [settings.joystick, settings.pressure, settings.scan.enabled, client, cursor, pushConfig]);

  // Con trỏ ảo chỉ chạy khi đã kết nối và không ở chế độ quét
  useEffect(() => {
    if (snap.state === 'connected' && settings.joystick.cursorEnabled && !settings.scan.enabled) cursor.start();
    else cursor.stop();
  }, [snap.state, settings.joystick.cursorEnabled, settings.scan.enabled, cursor]);

  const connect = useCallback((input, opts = {}) => {
    const s = settingsRef.current;
    const url = normalizeWsUrl(input ?? s.ip, { port: opts.port ?? s.port, path: opts.path ?? s.path });
    if (!url) {
      notify(tRef.current('esp.badIp'), 'bad');
      return false;
    }
    patch(null, { ip: input ?? s.ip });
    client.connect(url);
    return true;
  }, [client, notify, patch]);

  const disconnect = useCallback(() => {
    client.disconnect();
    notify(tRef.current('esp.disconnectedToast'), 'info');
  }, [client, notify]);

  /** Nhớ một thiết bị đã dùng để lần sau dò nhanh hơn. */
  const rememberDevice = useCallback((host) => {
    const cur = settingsRef.current.devices || [];
    if (host && !cur.includes(host)) patch(null, { devices: [host, ...cur].slice(0, 6) });
  }, [patch]);

  useEffect(() => {
    if (settings.autoConnect) connect(settings.ip);
    return () => client.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ client, cursor, snap, tel, connect, disconnect, pushConfig, onGesture, rememberDevice }), [client, cursor, snap, connect, disconnect, pushConfig, onGesture, rememberDevice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEsp32 = () => useContext(Ctx);
