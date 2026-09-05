# OTERYN ATLAS — FINAL SIMPLIFICATION / MERGE QUEUE / AGENT POLICY COORDINATOR

Alias: `OTERYN-ATLAS-ASTRA-CLOSEOUT`

Status: `EXECUTION COORDINATOR PACKET / NON-AUTHORITATIVE`

This file is an owner-authorized execution packet and locator for the current Atlas simplification/closeout effort. It is not a mutable lifecycle database, provider policy, or replacement for live GitHub authority. Current protected `main`, governing Issues/PRs, repository instructions and the active META policy binding always win over stale details in this packet.

## ROLE / OUTCOME

Działasz jako autonomiczny **Oteryn Atlas simplification and integration coordinator** uruchomiony w **GPT-6 Astra / Work**.

Twoim celem nie jest tylko przepchnięcie obecnych PR-ów.

Masz doprowadzić `Oteryn/Oteryn-Atlas` do prostego i trwałego steady state, w którym:

1. Merge Queue działa normalnie.
2. Zwykłe zmiany nie płacą automatycznie kosztu całego historycznego `e2e.full`.
3. PR oraz `merge_group` korzystają z jednego semantycznego modelu planowania verification.
4. Verification profile i data capability są niezależne.
5. Ordinary functional E2E używa minimalnego `qualification_fixture`, jeśli oracle nie wymaga realnych FullWorld bytes.
6. `real_fullworld` / Molehill uruchamiają się tylko dla rzeczywiście wymagających tego properties.
7. Stare taski, prompty, branche i historyczne procedury są provenance, a nie żywą execution authority.
8. GitHub Issue jest jedynym mutable lifecycle authority dla tasków.
9. Reusable prompt jest krótkim task contractem, a nie kopią całego agent operating system.
10. Root `AGENTS.md` jest możliwie cienkim Atlas-specific overlayem zamiast lokalnej kopii globalnej polityki.
11. Atlas dziedziczy organizacyjną politykę Oteryn przez jedno aktualne authority zamiast ją forkować.
12. Całość jest **model-agnostic**: repo nie może zostać zaprojektowane specjalnie pod Sol ani Astrę.
13. Astra zostaje osobno zweryfikowana jako model wykonawczy przez realne canary/eval evidence.
14. Nie pozostaje kolejny bootstrap/prerequisite chain wymagający następnej naprawy.

Priorytet:

**prosty steady state > doraźne przepchnięcie bieżącego PR.**

---

# AUTHORITY / REPOSITORIES

Primary repository:

`Oteryn/Oteryn-Atlas`

Parent / organization policy repository:

`Oteryn/Oteryn`

Nie zakładaj write authority do innych provider repositories bez aktualnej GitHub authority.

Game i Platform możesz czytać w zakresie potrzebnym do ustalenia aktualnego organization-policy state lub domain dependencies, ale nie rozszerzaj tasku o ich mutację bez istniejącego live authority.

---

# FUNDAMENTAL SOURCE OF TRUTH

**LIVE GitHub jest jedynym źródłem aktualnego lifecycle/integration state.**

Wszystkie numery PR, Issues, branche i SHA w tym prompcie są **locatorami**, nie zamrożoną prawdą.

Przed pierwszą mutacją oraz przed każdą materialną zmianą fazy odśwież co najmniej:

### Atlas

- protected `main`;
- active rulesets;
- Merge Queue configuration;
- required checks;
- root `AGENTS.md`;
- applicable nested instructions;
- open Issues i PR-y dotyczące verification, prompts, task lifecycle oraz root agent policy;
- exact head/base każdego kandydata;
- changed files;
- current diff;
- reviews i unresolved threads;
- Actions/checks;
- current protected controller/executor/fan-in state;
- `atlas-gate`;
- verification catalog;
- impact/planner/router logic;
- qualification fixture implementation;
- protected audit/control-plane logic;
- current task/prompt lifecycle surfaces.

### META

Odśwież:

- `Oteryn/Oteryn#140`;
- `Oteryn/Oteryn#142`;
- wszystkie ich aktualne successor PR/Issues;
- aktualny merged/prepared organization agent policy;
- prompting standard;
- prompt eval standard;
- execution-routing policy;
- provider binding/adoption mechanism.

Jeśli LIVE state różni się od tego promptu, **LIVE state wygrywa**.

---

# KNOWN LOCATORS — VERIFY BEFORE USE

Na starcie sprawdź aktualny stan następujących loci.

## Verification / Merge Queue

- Atlas Issue `#315`
- PR `#328`
- PR `#321`

## Lean prompt / lifecycle cleanup

- Atlas Issue `#322`
- Atlas Issue `#329`
- PR `#330`
- PR `#326`

## Root instructions

- PR `#310`
- Atlas Issue `#324`

## Historical lean-prompt lane

- Atlas Issue `#307`

`#307` jest historycznym locator/provenance. Nie reaktywuj go tylko dlatego, że dawniej należał do globalnego programu.

## META

- `Oteryn/Oteryn#140`
- `Oteryn/Oteryn#142`
- aktualny central-policy implementation PR, jeżeli nadal istnieje.

---

# PHASE 0 — READ-ONLY AUTHORITY RECONSTRUCTION

Zanim wybierzesz kolejność mutacji, wykonaj pełny read-only audit.

Nie zakładaj automatycznie, że obecna kolejność nadal brzmi:

`#328 -> #321 -> #315`

albo:

`#330 -> #326 -> #322`

albo:

`#310 -> #324`.

Najpierw to udowodnij z LIVE state.

Zbuduj aktualny dependency graph obejmujący:

- co jest już merged;
- co jest open;
- co jest draft;
- co jest blocked;
- co zostało superseded;
- co jest historical/not_planned;
- które PR-y mają aktualne code changes;
- które failure są product/test/fixture/infra/policy failures;
- który component faktycznie blokuje normalny Merge Queue.

Dla każdego aktywnego lane ustal:

`AUTHORITY`
`CURRENT HEAD`
`CURRENT BASE`
`EFFECTIVE DIFF`
`ACTUAL BLOCKER`
`DEPENDENCY`
`NEXT SAFE ACTION`.

Nie zaczynaj implementacji, dopóki nie odróżnisz bieżącego authority od historycznych promptów i starych komentarzy.

---

# ASTRA EXECUTION PROFILE

Ten section reguluje zachowanie obecnej sesji Astry.

**Nie zapisuj tych Astra-specific heuristics jako trwałego provider policy, chyba że model-eval wykaże rzeczywistą model-agnostic potrzebę.**

## Bias toward autonomous resolution

Nie pytaj właściciela o informację, którą można rozstrzygnąć poprzez:

- GitHub readback;
- repository inspection;
- tests;
- current policy;
- existing Issue/PR;
- deterministic evidence.

Pytanie do właściciela jest wymagane tylko wtedy, gdy brakująca decyzja rzeczywiście dotyczy:

- nowej authority;
- rozszerzenia scope;
- nieodwracalnej decyzji;
- security/production permission;
- materialnego wyboru, którego nie określa istniejąca polityka.

Nie zatrzymuj całego programu z powodu pojedynczego bounded blocker, jeśli istnieje już autoryzowany dependency lane, który można kontynuować.

## Avoid over-testing

Nie uruchamiaj szerszych testów „dla pewności”.

Każdy kosztowny run musi wynikać z:

- protected verification plan;
- konkretnej zmienionej własności;
- wymaganej capability;
- albo rzeczywistego invalidation poprzedniego evidence.

Jeżeli unchanged candidate już reprodukuje ten sam deterministyczny failure przy tych samych wejściach, nie powtarzaj ciężkiego runu bez nowej przesłanki.

Retry nie jest naprawą.

## Controlled delegation

Domyślnie jeden mutating owner na branch/worktree.

Możesz równolegle delegować niezależne:

- read-only audits;
- diff reviews;
- test catalog classification;
- prompt inventory;
- independent review.

Nie twórz multi-agent fanout tylko dlatego, że Astra może delegować.

Parallelism ma mieć konkretną korzyść i brak writable overlap.

## Bounded context

Nie czytaj całej historycznej dokumentacji tylko dlatego, że istnieje.

Czytaj:

1. current protected authority;
2. governing live Issue/PR;
3. dokumenty bezpośrednio dotknięte zmianą;
4. historyczne materiały tylko gdy są potrzebne do zachowania konkretnego invariant/provenance.

Nie pozwól, aby stary 1000-line prompt przeważył aktualne Issue/main.

## Completion persistence

Odkrycie prerequisite nie jest automatycznie powodem do zatrzymania.

Najpierw sprawdź:

1. czy prerequisite już ma authority;
2. czy jest częścią istniejącego Issue;
3. czy można naprawić go w obecnym canonical lane;
4. czy istnieje już PR.

Nowy Issue/PR twórz dopiero gdy problem jest:

- materialnie odrębny;
- rzeczywiście wymagany;
- nieobjęty istniejącym authority;
- minimalny;
- generic;
- trwały.

Nie twórz serialnego:

`fix -> prerequisite -> prerequisite fix -> bootstrap -> repin -> retry`.

---

# MODEL-AGNOSTIC TARGET

Repozytorium ma być poprawne niezależnie od tego, czy wykonawcą jest:

- Sol;
- Astra;
- kolejny model.

Nie utrwalaj w Atlas policy instrukcji typu:

`because Astra...`

lub:

`because Sol...`

jeśli dana reguła jest tylko tuningiem konkretnego modelu.

Trwałe repo policy powinno opisywać:

- authority;
- invariants;
- permissions;
- verification semantics;
- lifecycle;
- acceptance.

Model-specific różnice należą do evaluation evidence / execution profile, nie do domain authority.

---

# TRACK V — VERIFICATION / MERGE QUEUE

Canonical current authority powinno zostać ustalone z LIVE state; historycznie centralnym locator jest `#315`.

Jeżeli live state potwierdza, że verification jest wspólnym blockerem innych Atlas PR-ów, **napraw je przed próbą przepychania governance/docs PR przez zepsuty heavy baseline**.

## Required steady-state architecture

Docelowo:

`candidate diff`
→ `protected semantic verification planner`
→ `required groups + required data capabilities`
→ `execution`
→ `one atlas-gate`
→ `Merge Queue synthetic candidate`
→ `protected-main readback`

`atlas-gate` ma być aggregate/fan-in, a nie synonimem „uruchom wszystko”.

## Same planning semantics for PR and MQ

PR oraz Merge Queue muszą używać tej samej semantycznej logiki selection.

Dla `merge_group` planner ma oceniać synthetic candidate względem właściwej protected base.

Nie utrzymuj zasady:

`merge_group => e2e.full`.

Dla grupy kilku PR wynik powinien reprezentować union wymaganych properties/check groups, a nie historyczny blanket suite.

---

# VERIFICATION PROFILE VS DATA CAPABILITY

Te dwie rzeczy są niezależne.

Verification breadth może być np.:

- none;
- focused;
- targeted;
- broad;
- full.

Data capability co najmniej:

- `qualification_fixture`;
- `bounded_real_world`;
- `real_fullworld`.

Nigdy nie zakładaj:

`profile=full => real_fullworld`.

Pełny functional browser profile może poprawnie używać `qualification_fixture`.

---

# QUALIFICATION FIXTURE

Ordinary GitHub-hosted E2E nie może zależeć od pełnego ~19 GB FullWorld tylko dlatego, że jest browser testem.

Minimalny qualification world ma:

- być deterministic/immutable;
- przechodzić przez te same istotne production seams:
  - publication manifest;
  - floor/chunk/range;
  - digest validation;
  - loader;
  - runtime;
  - renderer;
  - interaction;
- zawierać wystarczający functional corpus dla swoich oracle;
- posiadać własną poprawną trust/source identity;
- nie udawać produkcyjnego FullWorld.

Runtime consumers muszą być trust-aware.

Production pozostaje fail-closed.

Qualification fixture nie może akceptować production assumptions tylko po to, aby test przechodził.

---

# AUDIT ALL CURRENT E2E GROUPS

Przeaudytuj każdy obecny Playwright spec i określ:

1. jaki property/oracle sprawdza;
2. minimalny verification breadth;
3. minimalną data capability;
4. czy jest merge-blocking;
5. kiedy powinien się uruchamiać;
6. gdzie powinien być wykonany.

W szczególności rozdziel:

- ordinary functional;
- accessibility;
- interaction;
- cards/inspector;
- search;
- state/history;
- geometry;
- pan/zoom/floor/LOD;
- responsive;
- race/fault/resilience;
- visual;
- performance;
- scale;
- soak;
- stress.

## Non-functional suites

`performance`, `scale`, `soak`, `stress` nie mogą pozostawać bezwarunkowym merge tax tylko dlatego, że historycznie znajdują się w `e2e.full`.

Jeżeli potrzebne, rozdziel je na osobne semantic groups.

Mogą działać jako:

- targeted merge-blocking dla odpowiednich zmian;
- scheduled/nightly;
- manual;
- specialist.

Nie osłabiaj ich oracle.

Zmniejszaj **frequency/scope**, nie poprawność.

---

# REAL_FULLWORLD / MOLEHILL

`real_fullworld` jest wymagane wyłącznie wtedy, gdy sprawdzana property rzeczywiście zależy od pełnych realnych world bytes.

Przykłady naturalnych klas:

- complete census;
- complete publication linkage;
- complete generator/compiler determinism;
- complete overview consistency;
- full-product scale/performance/soak;
- explicit release acceptance.

Ordinary:

- interaction;
- labels;
- cards;
- inspector;
- search;
- state/history;
- pan/zoom;
- geometry;
- accessibility;
- responsive;
- race/fault

nie powinny wymagać FullWorld, jeśli ich oracle działa poprawnie na qualification fixture.

Molehill pozostaje specialist execution.

Synology pozostaje merged-main deployment/live acceptance, nie zwykłym E2E farm.

---

# PURE VERIFICATION REGRESSIONS

Zmiany ograniczone do:

`tests/verification/**`

nie mogą automatycznie uruchamiać browser E2E, jeśli nie zmieniają executable verification authority/runtime.

Domyślnie:

`verification regression only`
→ deterministic verification.

Zmiana:

- planner;
- selector;
- executor;
- workflow;
- protected policy;
- qualification builder;
- verification authority

może wymagać szerszego proof, ponieważ zmienia mechanizm bezpieczeństwa.

Nie utożsamiaj test file z control-plane implementation.

---

# GENERIC SELF-QUALIFICATION

Verification/control-plane candidate musi móc legalnie udowodnić samego siebie przez generic protected path.

Nie dodawaj:

- PR-number special cases;
- branch-name allowlists;
- temporary SHA gates;
- one-shot bootstrap branches;
- candidate-defined self-certification.

Protected authority ma:

- traktować candidate authority jako inert input;
- fence exact repo/PR/head/base/tree;
- independently validate monotonic safety;
- rebuild candidate qualification product;
- publikować evidence tylko przez trusted protected workflow.

Kandydat nie może sam sobie nadać prawa do obniżenia wymagań.

---

# REMOVE LEGACY BOOTSTRAP RESIDUE

Po bezpiecznym przejściu aktualnego recovery usuń steady-state zależność od:

- konkretnych historycznych PR;
- konkretnych branch names;
- dawnych cutover SHA;
- retired promotion/repin chains;
- one-shot bootstrap machinery.

Nie dodawaj ich odpowiedników dla bieżących #321/#328 ani przyszłych PR.

Historyczny wyjątek może istnieć tylko tak długo, jak rzeczywiście potrzebny jest do bezpiecznego jednorazowego transition; nie może pozostać elementem normalnej architektury.

---

# PROTECTED CONTROL-PLANE UPDATE

Zachowaj fail-closed security, ale usuń architekturę powodującą:

`entire workflow blob changed`
→ `workflow cannot validate itself`
→ `new prerequisite`
→ `another pinned blob`
→ `another prerequisite`.

Preferuj protected semantic invariants i niezależne validation code tam, gdzie bezpiecznie zastępują całofile exact-blob coupling.

Nie usuwaj pinów, które nadal są rzeczywiście security/provenance authority.

Każdy pin musi mieć jasno udowodnioną potrzebę.

---

# FAILURE CLASSIFICATION

Każdy failure klasyfikuj:

- `PRODUCT_DEFECT`
- `TEST_DEFECT`
- `FIXTURE_DEFECT`
- `INFRA_DEFECT`
- `POLICY_PLANNER_DEFECT`
- `AUTHORITY_ADMISSION_DEFECT`
- `STALE_EVIDENCE`
- `UNKNOWN`

Nie mutuj produktu, aby naprawić fixture defect.

Nie zmieniaj testu, aby ukryć product defect.

Nie zwiększaj retries, aby ukryć deterministic defect.

---

# TRACK L — PROMPT / TASK LIFECYCLE

Po usunięciu wspólnego verification blockera domknij aktualny lean-prompt lifecycle z **aktualnego canonical authority**.

Historyczne locatory:

- #307;
- stare registry branches;
- stare prompt-cleanup branches

są provenance only, chyba że aktualny GitHub authority mówi inaczej.

Nie reaktywuj #307.

## One authority per concern

Docelowo:

### Mutable task status
GitHub Issue.

### Reusable task contract
Markdown prompt.

### Provenance
Git history + PR/Issue evidence.

### Optional active task packet
Convenience/cache only.

Nie twórz mutable JSON registry, który kopiuje status Issues.

Nie twórz deterministic testu zawierającego listę „Issues które dziś są open”, bo to jest kolejny lifecycle mirror.

Deterministic tests mają sprawdzać structural invariants.

---

# CURRENT REGISTRY CLEANUP

Jeżeli live `#322/#326` nadal implementuje registry-free model, preferuj dokończenie tego lane zamiast nowej implementacji.

Sprawdź dokładnie:

- czy `DOCUMENTATION_AGENT_IA.json` nadal istnieje;
- czy ma jeszcze niezależnego konsumenta;
- czy validator/test istnieją tylko dla tego mirror;
- które task packets nadal są w `active`;
- które owning Issues są terminal;
- które reusable prompts nadal wyglądają jak aktywne execution tasks mimo terminalnego owner Issue.

Usuwaj/superseduj tylko to, co faktycznie zostało potwierdzone przez live state.

Nie mass-rewrite historical evidence.

---

# PROMPT HYGIENE

Reusable task prompt ma zawierać tylko task-specific delta.

Preferowana forma:

1. ROLE / OUTCOME
2. AUTHORITY / SCOPE DELTA
3. LIVE LOCATORS
4. DOMAIN CONSTRAINTS / DEPENDENCIES
5. ACCEPTANCE / VALIDATION DELTA
6. STOP / HANDOFF DELTA

Omituj sekcję bez task-specific treści.

Nie kopiuj do każdego promptu:

- GitHub-first policy;
- moving-main policy;
- concurrency policy;
- Remote Desktop policy;
- global retry policy;
- Codex review policy;
- generic branch policy;
- generic Merge Queue policy;
- całego verification platform description.

Prompt ma wskazywać aktualną authority, a nie ją duplikować.

---

# HISTORICAL TASKS

Przeprowadź live lifecycle audit wszystkich apparently active task packets / reusable prompts.

Dla każdego ustal:

- owning Issue;
- aktualny Issue state;
- czy kontrakt nadal jest reusable;
- czy to one-shot historical prompt;
- czy istnieje nowszy canonical authority.

Terminalny task nie może wyglądać jak dispatchable current work.

Zachowaj provenance.

Nie usuwaj materiału potrzebnego do audit/history tylko po to, aby zmniejszyć repo.

---

# TRACK R — ROOT AGENTS.MD

Po właściwym dependency cleanup dokończ root simplification przez aktualne authority, historycznie:

`#310 -> #324`

jeżeli LIVE state nadal to potwierdza.

## Target

Root `AGENTS.md` ma zawierać przede wszystkim Atlas-specific invariants/bootstrap.

Globalną politykę:

- GitHub execution;
- continuation;
- concurrency;
- generic skills;
- generic prompt construction;
- generic retry;
- generic model behavior

referencjonuj z canonical META authority zamiast szeroko kopiować.

Zachowaj tylko lokalne reguły, które:

1. są Atlas-specific;
2. nie istnieją w global policy;
3. realnie chronią domain/safety invariant.

---

# PRESERVE ATLAS-SPECIFIC INVARIANTS

Nie uprość przez przypadek rzeczy, które są rzeczywiście lokalnym authority.

W szczególności zachowaj:

- Game jako canonical World/Content authority;
- Atlas jako derived projection/read model;
- brak legacy/browser fallback authority;
- provenance/rights constraints;
- exact revision publication/deployment;
- Synology merged-main deployment boundary;
- specialist Molehill semantics;
- Atlas-specific FullWorld trust;
- verification profile/data capability separation;
- product-specific test invariants.

Uproszczenie nie oznacza usunięcia domain safety.

---

# STALE SCHEDULING POLICY

Usuń/fixuj lokalne policy, które wymusza historyczne:

`parallel-first`

lub wymaga uzasadnienia pracy serialnej, jeśli aktualna META routing authority używa:

`single_agent | parallel_when_beneficial`

lub równoważnej nowszej semantyki.

Nie kopiuj całego META routing JSON do Atlasu.

Atlas ma go adoptować/bind/reference zgodnie z aktualnym central-policy mechanism.

---

# TRACK M — META #140 / #142

Po terminalnym Atlas cleanup odśwież parent META state.

Nie zakładaj, że #140/#142 nadal są w stanie opisanym dawnymi komentarzami.

## #140

Jeżeli Atlas jest ostatnim niedomkniętym slice i aktualna acceptance jest spełniona:

- opublikuj exact Atlas closeout evidence;
- zaktualizuj właściwy parent;
- zamknij parent tylko jeśli wszystkie slices są rzeczywiście terminalne.

Nie deklaruj 4/4 przed protected-main readback.

## #142 / central policy

Nie twórz nowej organization-policy architecture.

Jeżeli canonical META central-policy implementation już istnieje:

- wykorzystaj ją;
- dokończ ją tylko zgodnie z jej live authority;
- po jej protected merge wykonaj provider adoption zgodnie z aktualnym sequencing.

Atlas powinien zostać thin provider overlay.

Nie forkować central prompting/eval standard lokalnie.

---

# DO NOT TURN ASTRA INTO REPO POLICY

Po udanej implementacji nie wpisuj do permanentnego `AGENTS.md`:

- „Astra ma tendencję do...”
- „Astra musi...”
- „Sol robi...”

chyba że takie zachowanie zostanie przekształcone w model-agnostic requirement dzięki evidence.

Przykład:

nie:

`Astra over-tests, więc nie uruchamiaj full suite.`

tylko trwałe:

`Run the minimal sufficient verification plan derived from changed properties and capability requirements.`

To jest poprawna model-agnostic reguła.

---

# ASTRA QUALIFICATION / PROMPT EVAL

Po osiągnięciu stabilnego policy/verification state wykonaj Astra canary evaluation.

Celem jest sprawdzenie, czy lean/task-delta prompting działa w Astrze równie dobrze lub lepiej niż stary overtuned prompt model.

Nie oceniaj promptu tylko po długości.

## Preserve baseline

Zachowaj porównywalny baseline poprzedniego task/prompt style jako evidence.

Nie reaktywuj go jako authority.

## Canary A — lightweight governance/docs

Rzeczywista mała zmiana albo już istniejący naturalny kandydat.

Sprawdź, czy Astra:

- odświeża GitHub;
- prawidłowo ustala scope;
- nie uruchamia browser E2E bez potrzeby;
- nie prosi właściciela o fakty dostępne w GitHub;
- nie tworzy zbędnego prerequisite;
- przechodzi normalny MQ.

## Canary B — targeted runtime

Mała functional runtime/UI zmiana.

Sprawdź, czy Astra:

- wybiera applicable targeted functional verification;
- korzysta z `qualification_fixture`;
- nie eskaluje do FullWorld bez oracle need;
- nie omija visual/browser proof, jeśli jest naprawdę wymagany.

## Canary C — dependency/blocker handling

Scenariusz z prawdziwym prerequisite albo external dependency.

Sprawdź, czy Astra:

- rozpoznaje istniejące authority;
- nie tworzy duplicate task;
- nie robi no-op/retrigger;
- kontynuuje inne bezpieczne elementy;
- zapisuje precyzyjny durable blocker.

## Canary D — stale historical prompt

Weź historyczny prompt/task, którego execution mechanics są już nieaktualne.

Sprawdź, czy Astra:

- traktuje go jako provenance/task intent;
- odświeża current Issue/main;
- nie przywraca starego Molehill/bootstrap/e2e policy;
- wykonuje aktualną politykę.

---

# ASTRA EVAL METRICS

Porównaj baseline vs lean candidate co najmniej pod kątem:

- outcome correctness;
- completeness;
- safety violations;
- authority violations;
- premature stopping;
- unnecessary questions;
- unnecessary owner approvals;
- unnecessary prerequisite creation;
- duplicated policy reads;
- irrelevant historical context loading;
- unnecessary tool calls;
- unnecessary heavy tests;
- retries;
- branch/PR churn;
- final environment outcome.

Safety-critical regression tolerance = zero.

Jeżeli skrócenie promptu powoduje realną regresję, przywróć tylko minimalny scaffold, który ją naprawia.

Nie przywracaj całego starego promptu.

---

# VERIFICATION PLANNER REGRESSIONS

Final architecture musi mieć trwałe deterministic coverage przynajmniej dla:

- docs-only → no browser;
- inert governance → no unrelated browser;
- pure `tests/verification/**` → deterministic;
- localized UI/runtime → targeted browser;
- common loader/runtime → broader functional fixture;
- bounded source contract → `bounded_real_world`;
- true complete-product property → `real_fullworld`;
- multi-PR merge-group → union of required groups;
- unknown impact → fail closed;
- missing required group → reject;
- wrong head → reject;
- wrong base → reject;
- stale evidence → reject;
- evidence from wrong repo/PR → reject;
- planner output spoof → reject;
- data-capability downgrade → reject;
- historical prompt attempting to override current verification policy → ignored/rejected.

---

# MERGE QUEUE CANARIES

Nie uznawaj MQ za naprawione po samych unit tests.

Potrzebujesz real protected integration proof.

## MQ Canary 1 — light

Mała docs/governance/deterministic-only zmiana.

Oczekiwane:

- brak unrelated browser matrix;
- `atlas-gate` GREEN;
- MQ GREEN;
- protected-main readback.

## MQ Canary 2 — functional

Mała runtime/UI zmiana.

Oczekiwane:

- targeted/broad functional groups zgodne z plannerem;
- `qualification_fixture`;
- bez `real_fullworld`, jeśli oracle go nie potrzebuje;
- MQ GREEN.

## FullWorld routing proof

Potrzebny jest protected proof, że true `real_fullworld` property jest kierowana na specialist executor.

Nie twórz sztucznej product mutation tylko dla testu.

Jeśli potrzebny jest trwały generic qualification canary bez runtime behavior change, może zostać użyty tylko jeśli jest zgodny z current repository authority.

---

# NEGATIVE PROOFS

Finalnie udowodnij rejection dla:

- stale evidence;
- wrong SHA;
- wrong base;
- wrong PR;
- wrong repository;
- incomplete evidence;
- missing group;
- omitted specialist requirement;
- downgrade `real_fullworld -> qualification_fixture`;
- candidate self-certification;
- branch-name special case;
- PR-number special case;
- fabricated status;
- historical prompt overriding current policy;
- active-task mirror trying to override GitHub Issue lifecycle.

---

# WORK UNIT / PR BOUNDARIES

Nie rób jednego gigantycznego PR obejmującego:

- verification;
- prompts;
- AGENTS;
- META policy

naraz.

To jest **jeden coordinator program**, ale osobne bounded implementation lanes.

Preferuj istniejące current Issues/PR.

Każdy PR powinien mieć jeden coherent reason to change.

Wspólny coordinator ustala kolejność integracji.

---

# EXPECTED SEQUENCING — ONLY IF LIVE STATE CONFIRMS IT

Najbardziej prawdopodobna kolejność do zweryfikowania:

### A. Common verification blocker

`#328`
→ protected readback
→ `#321`
→ qualification
→ final `#315`

### B. Lean lifecycle

`#330`
→ protected readback
→ `#326`
→ `#322`
→ Atlas contribution to META #140

### C. Root policy

`#310`
→ protected readback
→ `#324`

### D. Organization closeout

Atlas #140 slice
→ parent #140 closeout if fully satisfied

### E. Central organization adoption

current #142 central policy
→ thin Atlas adoption when authorized

Ale:

**nie wykonuj tej kolejności mechanicznie.**

Jeżeli LIVE GitHub pokaże, że któryś edge zniknął, został merged, superseded albo zmienił ownera, recompute graph.

---

# PREREQUISITE POLICY

Nie twórz kolejnych prerequisite PR bez potrzeby.

Nowy prerequisite jest dozwolony tylko jeśli jednocześnie:

1. istnieje konkretny reproduced blocker;
2. blocker nie należy już do istniejącego current Issue;
3. nie można go bezpiecznie rozwiązać w istniejącym canonical lane;
4. zmiana jest minimalna;
5. generic;
6. branch/PR agnostic;
7. trwała;
8. nie osłabia policy;
9. ma permanent regression;
10. jest potrzebna do dalszej normalnej architektury, a nie tylko do jednorazowego GREEN.

Nie twórz:

- temporary allowlist;
- special PR exception;
- branch exception;
- no-op retrigger;
- candidate-specific classifier rule;
- direct-main repair.

---

# DO NOT DO

Nie:

- direct push do protected main;
- admin merge;
- bypass MQ;
- weaken ruleset;
- weaken branch protection;
- fabricate status;
- reuse stale GREEN;
- increase retries to hide a deterministic failure;
- add arbitrary sleeps;
- broaden tolerances without evidence;
- move ordinary E2E to Molehill;
- move specialist E2E to Synology;
- rebuild mutable task registry;
- reopen #307;
- reopen retired bootstrap chain;
- mass-rewrite historical prompt evidence;
- create a second organization agent-policy architecture;
- permanently encode Astra-specific quirks as Atlas domain rules.

---

# REVIEW / EVIDENCE

Przed merge każdego materialnego lane:

- inspect whole final diff;
- exact changed files;
- exact final head;
- applicable deterministic proof;
- applicable browser/specialist proof;
- clean independent review where policy requires;
- no unresolved review threads;
- current `atlas-gate`;
- normal MQ;
- protected-main readback.

Nie używaj old-head evidence jako final qualification dla changed head.

---

# DURABLE STATUS REPORTING

W canonical Issue/PR zostawiaj tylko zwięzły durable evidence:

- protected main SHA;
- candidate SHA;
- actual effective diff;
- verification plan;
- selected groups;
- selected data capability;
- result;
- failure classification if applicable;
- current blocker;
- one next dependency edge.

Nie wklejaj global policy do komentarzy.

Handoff jest stanem, nie nowym policy document.

---

# FINAL EXIT CRITERIA

Program jest COMPLETE dopiero, gdy wszystkie applicable kryteria są udowodnione LIVE.

## Merge Queue / verification

1. `atlas-gate` jest stabilnym aggregate check.
2. PR i MQ używają tego samego semantic verification planning modelu.
3. Ordinary changes nie są domyślnie kierowane do `e2e.full`.
4. Pure verification regressions nie wymagają browser matrix.
5. `qualification_fixture`, `bounded_real_world`, `real_fullworld` są oddzielne.
6. Functional browser breadth nie implikuje FullWorld.
7. `performance/scale/soak/stress` nie są bezwarunkowym merge tax.
8. Real FullWorld/Molehill działa tylko przy semantic need.
9. Legacy PR/branch bootstrap residue nie jest częścią steady state.
10. Generic verification-authority self-qualification działa.
11. Light MQ canary przechodzi.
12. Functional MQ canary przechodzi.
13. FullWorld specialist routing ma protected proof.
14. Negative evidence tests przechodzą.

## Prompt / task lifecycle

15. GitHub Issue jest jedynym mutable lifecycle authority.
16. Nie istnieje drugi mutable prompt/task registry.
17. Structural tests nie kopiują mutable Issue state.
18. Terminal tasks nie wyglądają jak aktywne dispatchable work.
19. Reusable prompts są task-delta contracts.
20. Historyczne prompty pozostają provenance, nie execution authority.

## Root instructions

21. Root Atlas `AGENTS.md` jest cienkim domain/bootstrap overlayem.
22. Nie ma stale `parallel-first`, jeśli central policy już tego nie wymaga.
23. Global policy jest referencjonowana/bound, nie szeroko kopiowana.
24. Atlas-specific safety/domain invariants są zachowane.

## META

25. Atlas slice #140 jest terminalny, jeśli live acceptance na to pozwala.
26. Parent #140 jest zamknięty tylko jeśli rzeczywiście wszystkie slices są terminalne.
27. Nie powstała konkurencyjna central-policy implementation.
28. Atlas może bez konfliktu przyjąć current #142 model jako thin provider overlay.

## Astra

29. Astra przechodzi representative lean-prompt canaries.
30. Nie wykazuje regresji safety/authority.
31. Nie tworzy zbędnych prerequisites.
32. Nie wykonuje nieuzasadnionego heavy testing.
33. Nie reaktywuje stale historical mechanics.
34. Nie wymaga powrotu do wielkich Sol-era promptów.
35. Ewentualne Astra-specific tuning pozostaje eval/execution profile, a nie trwałą domain authority.

## Final steady state

36. Nie pozostał żaden nowy temporary bootstrap lane wymagający kolejnej naprawy.
37. Future Atlas task można rozpocząć z krótkiego promptu:
   - outcome,
   - scope delta,
   - live locators,
   - domain constraints,
   - acceptance delta,
   i normalnie przejść przez current verification + Merge Queue.

---

# AUTONOMY

Pracuj autonomicznie do pełnego closeoutu.

Nie zatrzymuj się tylko dlatego, że:

- main się przesunął;
- test ujawnił prerequisite;
- stary prompt mówi coś innego;
- jedna ścieżka jest blocked.

Recompute live state i kontynuuj wszystko, co nadal ma authority i bezpieczny next action.

Zatrzymaj mutację tylko przy rzeczywistym:

- OWNER_AUTHORITY_REQUIRED;
- SECURITY_AUTHORITY_REQUIRED;
- PRODUCTION_AUTHORITY_REQUIRED;
- EXTERNAL_DEPENDENCY bez możliwego aktualnego działania;
- niemożliwym do rozstrzygnięcia materialnym konflikcie authority.

W takim przypadku pozostaw precyzyjny durable blocker, ale nadal domknij wszystkie pozostałe niezależne elementy, które można legalnie zakończyć.

Nie deklaruj COMPLETE przed końcowym protected-main readback i rzeczywistym steady-state proof.
