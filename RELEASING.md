# Releasing Artisans Compass

**그냥 `master`에 push하세요. 끝.**

[.github/workflows/release.yml](.github/workflows/release.yml)이 자동으로:

1. `package.json` version이 마지막 GitHub Release와 같으면 **patch +1**
   (예: `0.4.16` → `0.4.17`).
2. 빌드 + GitHub Release에 `.exe` / `latest.yml` publish.
3. bump한 `package.json`을 `chore: release vX.Y.Z [skip ci]` commit으로
   다시 master에 push.

사용자 앱은 30초 안에 새 release를 감지하고 업데이트 알림을 띄웁니다.

---

## 어떻게 동작하나

| 내가 push한 commit의 상태 | workflow 행동 | 결과 |
|---|---|---|
| `package.json` 그대로 (대부분의 경우) | patch 자동 +1 → publish → bump commit push | 새 release |
| `package.json` version을 직접 올렸음 (`minor`/`major` 필요할 때) | 그 version 그대로 publish, bump 안 함 | 새 release |
| bot이 만든 `[skip ci]` commit | trigger 안 됨 | 아무 일 없음 |

핵심: **언제나 새 release가 나옵니다.** "이번 commit은 release 안 만들고 싶다"는 옵션은 의도적으로 없습니다 (그게 요구사항이었으니).

---

## minor / major bump가 필요하면

자동 bump는 항상 `patch`입니다. 큰 변경은 직접 올려서 push하세요.

```bash
# 0.4.16 → 0.5.0
npm version minor --no-git-tag-version
rtk git add package.json
rtk git commit -m "release v0.5.0"
rtk git push
```

workflow가 `package.json`에 이미 새 version이 있으면 auto-bump를 건너뛰고 그 version으로 publish합니다.

---

## 필요한 secret

| 이름 | 필수? | 용도 |
|---|---|---|
| `GITHUB_TOKEN` | ✅ 자동 제공 | release publish + bump commit push |
| `ENV_FILE` | 선택 | 빌드된 앱의 Google/Notion OAuth 동작용. 로컬 `.env` 내용 전체를 그대로 복붙. 없으면 OAuth만 비활성, 빌드는 정상. |

`ENV_FILE` 등록: repo → Settings → Secrets and variables → Actions → New repository secret.

---

## 무한 루프 방지가 어떻게 되어 있나

- bump commit message에 `[skip ci]`가 들어가서 GitHub Actions가 그 commit을 트리거 안 함.
- 추가로, `GITHUB_TOKEN`으로 push한 commit은 GitHub 정책상 다른 workflow도 트리거하지 않음 (이중 안전장치).

---

## 첫 release 직후 로컬 동기화

bot이 master에 bump commit을 만들기 때문에, 다음 작업 전에 반드시:

```bash
rtk git pull
```

안 하면 다음 push가 `non-fast-forward`로 reject됩니다.

---

## 수동 실행

급할 때 GitHub UI에서 직접 실행:

1. https://github.com/YuInseo/artisans-compass/actions
2. **Build & Release** 선택
3. **Run workflow** → `master` → 실행
4. push와 똑같이 auto-bump + publish + bump commit.

---

## Troubleshooting

| 증상 | 해결 |
|---|---|
| `Resource not accessible by integration` | workflow의 `permissions: contents: write` 필요. 현재 파일에 들어있음. |
| `tag vX.Y.Z already exists` | 같은 version으로 두 번 publish 시도. 보통 일어나면 안 됨 (auto-bump가 막음). 직접 `package.json`을 올려서 push하면 해결. |
| 다음 push가 `non-fast-forward` reject | bot이 만든 bump commit을 못 받은 상태. `git pull` 후 다시 push. |
| 사용자 앱 "업데이트 확인 시간 초과" | timeout은 30초로 잡혀 있음 ([electron/main.ts](electron/main.ts)). release 자체가 정상 publish 되었는지 확인. |
| 빌드는 되는데 Google/Notion 로그인 실패 | `ENV_FILE` secret 미설정. |
| Release는 났는데 사용자 앱이 못 봄 | release에 `latest.yml`이 있는지 확인. 없으면 electron-builder publish 단계 실패. workflow 로그 확인. |
