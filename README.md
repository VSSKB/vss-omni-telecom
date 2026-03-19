# VSS Ecosystem v2.0: Omni Telecom Framework



## 🌌 Архитектура "Демиург и Архонты"
Платформа **VSS (Victim Search System)** эволюционировала в универсальный стек гибридной оркестрации. Система разделяет **Намерение** (Demiurge AI) и **Исполнение** (Archon Execution).

### Ключевые векторы:
1. **Civilian (Profit):** Оркестрация колл-центров, QA-автоматизация мобильных ферм, агрегация трафика.
2. **Military (Defense):** Тактический C2, OSINT/SIGINT аналитика, управление роем устройств.

### Технологическое ядро:
* **@OTTB:** Программно-аппаратный мост телефонии (PJSIP + WebRTC).
* **@DCI:** Распределенная контейнерная инфраструктура на базе K3s.
* **@MIMIC FLOW:** AI-движок на базе Gemini 2.5 Flash для автоматизации социального взаимодействия.
* **@TRAY BRIDGE:** Локальный агент для управления физическими USB-хабами и ADB.

## 🏗 Развертывание
Для пуска системы в эксплуатацию:
```bash
git checkout -b feature/vss-ottb-v2-migration
helm upgrade --install vss-ottb ./charts/vss-ottb -n vss-system --create-namespace
```

---
**Architect:** Vladimir G. | **Version:** 2.0-Production
