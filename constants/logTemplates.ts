export const logTemplates = {
  onboarding_completed: 'Подключение установлено',
  crack_launch_failed:
    'Ошибка доступа к сайту {targetUrl} с логином {targetEmail}',
  crack_attempt_failed:
    'Ошибка доступа: проверьте корректность данных {targetUrl}, {targetEmail}',
  crack_access_granted:
    'Доступ к {targetUrl} получен. Пароль: {resultPassword}',
  decipher_launch_failed: 'Не удалось расшифровать путь к папке: {folderPath}',
  decipher_access_granted:
    'Папка {folderPath} расшифрована. Пароль: {folderPassword}',
  rdp_invalid_ip: 'Неверный IP-адрес: {ip}',
  rdp_puzzle_solved: 'Соединение с {logSubjectName} установлено',
  rdp_timer_expired: 'Сеанс прерван: соединение разорвано',
  rdp_session_lost:
    'Доступ к {logSubjectName} потерян: обнаружено два активных сеанса. Новый IP: {nextIp}',
  rdp_folder_unlocked:
    'Папка {folderPath} в системе {logSubjectName} разблокирована. Пароль: {folderPassword}',
  rdp_completed: 'Изучение материалов завершено',
  final_report_submitted: 'Финальный отчёт сдан. Результат: {percent}%',
  mission_completed_overview: 'Миссия "{displayName}" — пройдена',
  game_restarted: 'Игра начата заново',
  admin_progress_reset: '[admin] Прогресс по миссии "{displayName}" сброшен',
  admin_mission_completed:
    '[admin] Миссия "{displayName}" отмечена как пройденная',
} as const;

export type LogTemplateKey = keyof typeof logTemplates;
