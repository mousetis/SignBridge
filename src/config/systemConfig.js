// Cấu hình hệ thống – chuyển từ system_configuration.json (docs/system_configuration.json).
// Các mục có chú thích "OVERRIDE" khác với file gốc theo yêu cầu mới nhất của dự án.
export const systemConfig = {
  system_info: {
    project_name: 'Hệ sinh thái hỗ trợ người khuyết tật (ESP32-S3 & Web AI Ngôn ngữ ký hiệu 2 chiều)',
    version: '1.0.0',
    processing_mode: 'Edge_Client_Side_AI',
    supported_languages: ['vi-VN', 'en-US'],
  },
  esp32_ip_connection: {
    microcontroller: 'ESP32-S3',
    protocol: 'WebSocket_over_Local_WiFi',
    default_ip: '192.168.1.100',
    websocket_port: 81,
    websocket_path: '/ws', // OVERRIDE: yêu cầu mới dùng ws://IP:81/ws
    http_config_port: 80,
    auto_reconnect_ms: 3000,
    telemetry_interval_ms: 20,
    hardware_sensors: {
      joystick_4_axis: { deadzone: 0.12, cursor_speed: 1.5, filter: 'MovingAverage_5' },
      pressure_sensor_MPXV7002DP: {
        measurement_range_kpa: [-2.0, 2.0],
        puff_left_click_kpa: 0.45,
        double_puff_window_ms: 350,
        sip_right_click_kpa: -0.45,
        hold_drag_duration_ms: 600,
      },
    },
  },
  ai_sign_to_text_engine: {
    camera_fps: 30,
    hand_tracking: {
      library: 'MediaPipe_Hands',
      max_hands: 1,
      keypoints_count: 21,
      min_detection_confidence: 0.5, // v2: hạ để máy bắt tay nhạy hơn (bước chốt chữ phía sau đã chặt hơn)
      min_tracking_confidence: 0.5,
    },
    recognition_models: {
      total_characters: 36,
      static_pose_classifier: {
        architecture: 'MLP_Neural_Network_TensorFlowJS',
        input_vector_size: 63,
        // 34 ký tự tĩnh: A–I, K–Y, 0–9 (J và Z là ký tự động)
        classes: [
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
          'X', 'Y', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        ],
        // v2 – chốt chữ theo TRUNG BÌNH trong lúc giữ tay (không phải từng khung), để vừa nhạy vừa chắc:
        confidence_threshold: 0.8, // độ tin cậy TRUNG BÌNH khi giữ ≥ 80%
        frame_floor: 0.6, // mỗi khung phải ≥ 60% (khung thấp hơn bị tính là "hụt")
        min_margin: 0.3, // chênh lệch TRUNG BÌNH giữa ký tự đứng đầu và ký tự thứ hai ≥ 30%
        frame_margin_floor: 0.15, // mỗi khung chênh lệch tối thiểu 15%
        hold_frames_to_confirm: 8, // tối thiểu 8 khung ổn định…
        hold_ms_to_confirm: 450, // …và tối thiểu 0,45 giây
      },
      dynamic_motion_classifier: {
        architecture: 'LSTM_Sequence_Network_TensorFlowJS',
        sequence_frames: 20,
        classes: ['J', 'Z'],
        confidence_threshold: 0.82,
      },
    },
    output_assembly: { auto_space_pause_ms: 1800, smart_word_autocomplete: true, text_to_speech_enabled: true },
  },
  text_voice_to_3d_hand: {
    speech_to_text: { engine: 'Web_Speech_API', continuous: true, auto_strip_diacritics: true },
    hand_3d_renderer: {
      engine: 'Three.js_WebGL',
      skeleton_joints: 21,
      transition_interpolation: 'Quaternion_SLERP',
      playback_speeds: [0.5, 0.75, 1.0, 1.25, 1.5],
      default_speed: 1.0,
    },
    synchronized_subtitle_bar: { enabled: true, highlight_current_letter: true, show_2d_hand_chart_hint: true, font_size_px: 36 },
  },
  deaf_mute_learning_module: {
    // OVERRIDE: 4 cấp độ theo yêu cầu mới (A–M / N–Z / 0–9 / Ghép từ)
    practice_feedback: {
      required_accuracy_percent: 80, // OVERRIDE: file gốc 85, yêu cầu mới ≥ 80%
      hold_success_ms: 1000,
      visual_alert_only: true,
    },
    scoring: { geometric_weight: 0.5, model_weight: 0.5 },
  },
  accessibility_ui: {
    theme: 'High_Contrast_Dark_Slate',
    min_button_size_px: 64,
    min_button_gap_px: 16,
    zero_audio_dependency: true,
    hands_free_cursor_friendly: true,
  },
};

export const STATIC_CLASSES = systemConfig.ai_sign_to_text_engine.recognition_models.static_pose_classifier.classes;
export const DYNAMIC_CLASSES = systemConfig.ai_sign_to_text_engine.recognition_models.dynamic_motion_classifier.classes;
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const DIGITS = '0123456789'.split('');
export const ALL_CHARS = [...LETTERS, ...DIGITS];
