# Oteryn Atlas — pakiet dowodowy pogłębionego audytu v2

Badany commit: `51623c7dab2346cee39cd51e3caa845bf4b65426`.

Otwórz `REPORT.html` lub `REPORT.md`. Ten pakiet nie jest checkoutem repozytorium ani certyfikatem gotowości produkcyjnej.

## Zawartość

`source-manifest.json` identyfikuje 13 pełnych plików zachowanych w `sources/` przez ich Git blob SHA. `probes/` zawiera własne programy audytowe. `results/` zawiera wyniki, logi, mutacje opisane jako celowe oraz małe publikacje wygenerowane wyłącznie z danych syntetycznych. Kod produktu w `sources/` nie zawiera poprawek audytora; mutacje wykonywano tylko w katalogach tymczasowych.

Plik `tools/build-creature-index.py` zachowano z poprzedniego audytu i ponownie sprawdzono blob. Nie jest nowym eksperymentem w v2. Historyczne 44 próby z pierwszego raportu nie są liczone jako nowe wyniki v2.

## Odtworzenie

Wymagane są lokalne Node.js 22 z dostępnym `node` w PATH i Python 3 ze standardowymi modułami, w tym `lzma`. Nie potrzeba tokenu, Playwright, Docker ani dostępu do GitHub.

```bash
python run-audit.py
```

Runner najpierw sprawdza wszystkie zachowane Git blob SHA. Następnie wykonuje kontrolę składni, cztery oryginalne testy, trzy dodatkowe kontrakty, próby runtime, zgodność między językami, dwa małe buildy, kontrolowane próby bezpieczeństwa generatora, fake-GL fault injection i cztery mutacje.

**`EXECUTED_WITH_FINDINGS` i exit 0 oznaczają zakończenie eksperymentów audytowych, a nie PASS produktu.** Część prób celowo odtwarza wady obecnego kodu. Wyniki czytaj wraz z oczekiwaniem i ograniczeniem zakresu w raporcie. `productQualification` pozostaje `NOT_PERFORMED`.

Runner zapisuje wyłącznie własne wyniki pod `results/` oraz używa tworzonych przez siebie katalogów tymczasowych. Nie kieruj narzędzi produktu bezpośrednio na prawdziwe repozytoria lub publikacje. Test kolizji `--output` świadomie wywołuje destrukcyjne zachowanie generatora, ale tylko na jednorazowej kopii syntetycznego fabric w `TemporaryDirectory`.

Własne fixture’y zawierają kompatybilnościowe nazwy pól źródła i pliku attestation, wymagane przez oryginalny generator. Są to jawne test doubles. Nie są rzeczywistym eksportem Game, pakietem Tibia, zgodą na prawa do assetów ani dowodem kwalifikacji rzeczywistego FullWorld. Wszystkie piksele fixture są generowane przez skrypt audytowy.

## Próby przeglądarkowe

Pliki `run-browser*.py`, `browser-renderer.html` i powiązane wyniki zachowano jako materiał z nieudanej kwalifikacji środowiska. Nie są wykonywane przez `run-audit.py`. HTTP localhost zostało odrzucone administracyjnie; network-free próba renderera nie uzyskała WebGL2. Nie prezentuj screenshotu tego harnessu jako dowodu działania aplikacji Atlas.

## Integralność pakietu

`package-files.sha256` opisuje pliki zawarte w dostarczonym pakiecie (z wyłączeniem samego manifestu). Pliki tego pakietu nie są publikowane do GitHub przez runner. Raport nie upoważnia do zmiany maintenance freeze ani do merge/deploy.
