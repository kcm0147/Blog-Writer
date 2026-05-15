# 네이버 블로그 작성기

내 블로그 글 스타일을 학습해서 매장 사진/메모만 주면 글을 자동으로 써주는 데스크탑 앱.

- LLM 제공자: Claude 또는 Gemini (사용자가 자기 API 키 입력)
- 플랫폼: Mac, Windows
- 사용자 데이터: 본인 PC에만 저장 (외부 서버 없음)

## 개발 환경

```bash
npm install
npm run dev      # 개발 모드 (창 자동 열림)
npm test         # 테스트
```

## 빌드

```bash
npm run build:mac    # release/ 아래에 dmg 생성
npm run build:win    # release/ 아래에 nsis 설치 파일 생성
```

## 첫 실행 흐름

1. 앱을 열면 사이드바에 ⚙️ **설정** 클릭
2. Provider 선택 (Claude 또는 Gemini) → API 키 입력 → "연결 확인"으로 검증
3. (선택) 웹 검색 토글
4. 📚 **내 스타일** 으로 가서 본인 글 10~30개를 차례로 붙여넣어 저장
5. "스타일 분석 시작" 클릭 → 프로파일이 생성됨
6. ✍️ **글 작성** 으로 가서 매장 정보, 사진, 메모 입력 → "글 만들기"
7. 결과를 네이버 블로그에 복사하고, `[사진N]` 마커 위치에 사진을 끼워 게시

## 문서

- 설계: `docs/specs/2026-05-13-naver-blog-writer-design.md`
- 디자이너 브리프: `docs/design-brief.md`
- 구현 계획: `docs/plans/2026-05-13-naver-blog-writer-implementation.md`

## 수동 검증 체크리스트

- [ ] Settings: Claude/Gemini 두 provider 모두 키 저장 → 키 삭제 → 다시 저장
- [ ] Settings: 잘못된 키로 연결 확인 → 실패 메시지
- [ ] Settings: 올바른 키로 연결 확인 → 성공 메시지
- [ ] My Style: 6개 글 추가 → 분석 → 프로파일 카드 표시
- [ ] My Style: 5개 미만일 때 경고 표시
- [ ] Compose: 필수 필드 누락 시 버튼 비활성화
- [ ] Compose: 사진 10장 초과 업로드 시도 → 10장으로 제한
- [ ] Compose: 정상 생성 → 결과 패널에 제목/본문/해시태그/사진 매핑 표시
- [ ] Compose: 생성된 본문 편집 가능, 복사 동작
- [ ] History: 생성한 글이 목록에 표시 → 클릭하여 다시 열람 → 삭제 동작
- [ ] 앱 종료 후 재실행 시 키/샘플/프로파일/히스토리 모두 보존
