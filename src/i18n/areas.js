// Danh sách các "area" ngôn ngữ (mỗi tệp khai báo { vi, en }). Thêm tệp mới ở đây.
import common from './areas/common.js';
import shell from './areas/shell.js';
import ui from './areas/ui.js';
import esp from './areas/esp.js';
import profile from './areas/profile.js';
import settings from './areas/settings.js';
import recognize from './areas/recognize.js';
import text from './areas/text.js';
import train from './areas/train.js';
import learn from './areas/learn.js';
import dict from './areas/dict.js';
import teacher from './areas/teacher.js';
import home from './areas/home.js';

export const AREAS = [common, shell, ui, esp, profile, settings, recognize, text, train, learn, dict, teacher, home];
