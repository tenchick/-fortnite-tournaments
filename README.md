# Fortnite Arena — Live MVP v4

## Запуск
Требуется Node.js 18+.

```bash
npm start
```

Откройте http://localhost:3000

## Что добавлено
- `/api/schedule?region=EU` получает актуальную страницу Fortnite Competitive Schedule через сервер.
- Кэширование на 5 минут, чтобы не запрашивать Epic при каждом открытии.
- Автообновление страницы каждые 10 минут.
- Переключение регионов EU/NAC/NAW/BR/ME/ASIA/OCE/NAE.
- Если Epic временно недоступен, интерфейс остаётся рабочим на демонстрационных данных.

Источник расписания: официальный Fortnite Competitive.
