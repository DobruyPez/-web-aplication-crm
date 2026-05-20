Файлы в этой папке — только для локальной разработки (не для продакшена).

localhost.key + localhost.crt
  Сгенерированы скриптом: npm run certs --prefix backend
  Библиотека: npm-пакет "selfsigned". Это самоподписанный сертификат на имя localhost.
  Браузер НЕ считает его выданным доверенным центром → предупреждение или ERR_CERT_AUTHORITY_INVALID.

mkcert-localhost-key.pem + mkcert-localhost.pem
  Создаются командой: npm run certs:mkcert --prefix backend
  Нужен установленный mkcert и один раз выполненное "mkcert -install" (локальный ЦС в системе).
  После этого браузер обычно показывает обычный "замочек" для https://localhost.

Если winget не ставит mkcert: npm run mkcert:download — кладёт бинарник в ../tools/

Установка локального ЦС в Windows:
  В PowerShell путь в кавычках сам по себе программу не запускает — нужен оператор & :
    & "B:\...\tools\mkcert.exe" -install
  В cmd.exe достаточно: "B:\...\tools\mkcert.exe" -install
