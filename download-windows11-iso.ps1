# Скрипт для загрузки Windows 11 ISO
# Автоматическая загрузка официального образа Windows 11 с сайта Microsoft

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      ЗАГРУЗКА WINDOWS 11 ISO                             ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Настройки
$downloadPath = "$env:USERPROFILE\Downloads"
$isoFileName = "Windows11_$(Get-Date -Format 'yyyyMMdd').iso"
$isoFullPath = Join-Path $downloadPath $isoFileName

Write-Host "📁 Путь загрузки: $isoFullPath`n" -ForegroundColor White

# Проверка свободного места (нужно минимум 10 GB)
$drive = (Get-Item $downloadPath).PSDrive
$freeSpace = [math]::Round($drive.Free / 1GB, 2)

Write-Host "💾 Свободное место на диске: $freeSpace GB" -ForegroundColor White

if ($freeSpace -lt 10) {
    Write-Host "❌ Недостаточно свободного места! Требуется минимум 10 GB" -ForegroundColor Red
    Write-Host "💡 Освободите место и запустите скрипт снова" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Достаточно места для загрузки`n" -ForegroundColor Green

# Официальные ссылки Microsoft
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "📋 ВАРИАНТЫ ЗАГРУЗКИ WINDOWS 11:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

Write-Host "1️⃣  ОФИЦИАЛЬНЫЙ САЙТ MICROSOFT (Рекомендуется)" -ForegroundColor White
Write-Host "   https://www.microsoft.com/software-download/windows11" -ForegroundColor Cyan
Write-Host "   → Выберите 'Download Windows 11 Disk Image (ISO)'" -ForegroundColor Gray
Write-Host "   → Выберите язык и версию" -ForegroundColor Gray
Write-Host "   → Скачайте ISO файл (~5.2 GB)" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  MEDIA CREATION TOOL (Windows 11)" -ForegroundColor White
Write-Host "   https://go.microsoft.com/fwlink/?linkid=2156295" -ForegroundColor Cyan
Write-Host "   → Прямая ссылка на Media Creation Tool" -ForegroundColor Gray
Write-Host "   → Запустите и выберите 'Create installation media'" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  АВТОМАТИЧЕСКАЯ ЗАГРУЗКА (через PowerShell)" -ForegroundColor White
Write-Host "   Используйте скрипт ниже ↓" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

Write-Host "🤔 Выберите действие:" -ForegroundColor Yellow
Write-Host ""
Write-Host "[1] Открыть официальный сайт Microsoft в браузере" -ForegroundColor White
Write-Host "[2] Скачать Media Creation Tool" -ForegroundColor White
Write-Host "[3] Скачать ISO напрямую (требуется прямая ссылка)" -ForegroundColor White
Write-Host "[Q] Выход" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Ваш выбор"

switch ($choice) {
    "1" {
        Write-Host "`n🌐 Открываю официальный сайт Microsoft..." -ForegroundColor Yellow
        Start-Process "https://www.microsoft.com/software-download/windows11"
        Write-Host "✅ Браузер открыт. Следуйте инструкциям на сайте." -ForegroundColor Green
    }
    
    "2" {
        Write-Host "`n📥 Загрузка Media Creation Tool..." -ForegroundColor Yellow
        $mediaCreationToolUrl = "https://go.microsoft.com/fwlink/?linkid=2156295"
        $mediaCreationToolPath = Join-Path $downloadPath "MediaCreationToolW11.exe"
        
        try {
            Write-Host "⏳ Загрузка... (это займет несколько минут)" -ForegroundColor Yellow
            
            # Загрузка с прогресс-баром
            $ProgressPreference = 'Continue'
            Invoke-WebRequest -Uri $mediaCreationToolUrl -OutFile $mediaCreationToolPath -UseBasicParsing
            
            Write-Host "✅ Media Creation Tool загружен!" -ForegroundColor Green
            Write-Host "📁 Файл: $mediaCreationToolPath" -ForegroundColor White
            Write-Host "`n🚀 Запуск Media Creation Tool..." -ForegroundColor Yellow
            Start-Process $mediaCreationToolPath
            
            Write-Host "✅ Готово! Следуйте инструкциям в окне программы." -ForegroundColor Green
        } catch {
            Write-Host "❌ Ошибка загрузки: $_" -ForegroundColor Red
            Write-Host "💡 Попробуйте вариант 1 (официальный сайт)" -ForegroundColor Yellow
        }
    }
    
    "3" {
        Write-Host "`n⚠️  ВНИМАНИЕ: Для прямой загрузки ISO нужна актуальная ссылка" -ForegroundColor Yellow
        Write-Host "💡 Рекомендуется использовать вариант 1 или 2" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Альтернативные источники:" -ForegroundColor White
        Write-Host "  • https://www.microsoft.com/software-download/windows11" -ForegroundColor Cyan
        Write-Host "  • https://uupdump.net (сборка UUP дампов)" -ForegroundColor Cyan
        Write-Host ""
    }
    
    default {
        Write-Host "`n👋 Выход" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "📋 СИСТЕМНЫЕ ТРЕБОВАНИЯ WINDOWS 11:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""
Write-Host "  • Процессор:     1 GHz или быстрее, 2+ ядра (64-bit)" -ForegroundColor White
Write-Host "  • RAM:           4 GB (рекомендуется 8 GB+)" -ForegroundColor White
Write-Host "  • Диск:          64 GB+ свободного места" -ForegroundColor White
Write-Host "  • TPM:           TPM 2.0" -ForegroundColor White
Write-Host "  • UEFI:          Secure Boot capable" -ForegroundColor White
Write-Host "  • GPU:           DirectX 12 compatible, WDDM 2.x" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""
Write-Host "📌 РЕКОМЕНДАЦИИ:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Используйте вариант 1 или 2 для безопасной загрузки" -ForegroundColor White
Write-Host "  2. Проверьте контрольную сумму SHA256 после загрузки" -ForegroundColor White
Write-Host "  3. Используйте Rufus для создания загрузочной флешки" -ForegroundColor White
Write-Host "     https://rufus.ie" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Скрипт завершен!" -ForegroundColor Green
Write-Host ""

