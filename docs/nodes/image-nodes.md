# 이미지 노드 (Image Nodes)

이미지 노드는 화면에서 이미지를 찾아 터치하는 기능을 제공하는 노드입니다.

## 구현된 노드

### image-touch (이미지 터치 노드)

화면에서 이미지를 찾아 터치하는 노드입니다.

**파일 위치**: `server/nodes/imagenodes/image_touch.py`

**노드 타입**: `image-touch`

**설명**: 지정된 폴더에 있는 이미지 파일들을 화면에서 찾아 순차적으로 터치합니다. OpenCV를 사용한 템플릿 매칭 기법을 사용합니다.

#### 파라미터

- `folder_path` (string, 필수): 이미지 파일이 있는 폴더 경로
- `timeout` (number, 선택): 이미지를 찾을 때까지 대기할 최대 시간 (초)
  - 기본값: 없음 (시스템 기본값 사용)
  - 최소값: 1
  - 최대값: 300
  - 0 이하의 값은 무시됩니다

#### 출력 스키마

```json
{
  "action": "image-touch",
  "status": "completed",
  "output": {
    "success": true,
    "folder_path": "C:\\images\\touch",
    "total_images": 3,
    "results": [
      {
        "image": "image1.png",
        "found": true,
        "position": [100, 200],  # 튜플 (x, y) 또는 None
        "touched": true
      },
      {
        "image": "image2.png",
        "found": false,
        "message": "화면에서 이미지를 찾을 수 없습니다."
      },
      {
        "image": "image3.png",
        "found": true,
        "position": [300, 400],  # 튜플 (x, y) - 이미지 중심점 좌표
        "touched": true
      },
      {
        "image": "image4.png",
        "error": "이미지 처리 중 오류 발생"
      }
    ]
  }
}
```

**출력 필드 설명:**
- `success`: 성공 여부 (boolean, 하나라도 이미지를 찾아서 터치했으면 `true`)
- `folder_path`: 이미지 폴더 경로 (string)
- `total_images`: 총 이미지 개수 (number)
- `results`: 이미지 검색 결과 (array)
  - `image`: 이미지 파일명 (string)
  - `found`: 발견 여부 (boolean, 이미지를 찾았으면 `true`)
  - `position`: 위치 튜플 [x, y] (array 또는 null, 이미지 중심점 좌표)
  - `touched`: 터치 여부 (boolean, `found`가 `true`일 때만 존재)
  - `message`: 에러 메시지 (string, 이미지를 찾지 못한 경우)
  - `error`: 에러 메시지 (string, 이미지 처리 중 오류 발생 시)

#### 동작 방식

1. **폴더 경로 검증**: 폴더 경로가 제공되었는지 확인하고, 폴더가 존재하는지 확인합니다
2. **이미지 파일 수집**: 폴더 내의 지원하는 이미지 파일들을 찾습니다
   - 지원 확장자: `.png`, `.jpg`, `.jpeg`, `.bmp`, `.gif`, `.tiff`, `.webp`
   - 파일 이름 순서대로 정렬됩니다
3. **화면 캡처**: 현재 화면을 캡처합니다 (`ScreenCapture`)
4. **이미지 검색 및 터치**: 각 이미지 파일에 대해:
   - 화면에서 이미지를 찾습니다 (`find_template` - OpenCV 템플릿 매칭, `threshold=0.7`)
   - 이미지를 찾으면 위치 정보를 받습니다 (`location = (x, y, width, height)`)
   - 이미지 중심점을 계산합니다 (`center_x = x + w // 2`, `center_y = y + h // 2`)
   - 중심점 위치를 터치합니다 (`InputHandler.click(center_x, center_y)`)
   - 결과를 기록합니다 (찾음/못 찾음, 위치, 터치 성공 여부)
   - 예외 발생 시 에러 정보를 기록합니다
5. **결과 반환**: 모든 이미지에 대한 검색 및 터치 결과를 반환합니다

#### 의존성

- **ScreenCapture**: 화면 캡처 및 이미지 찾기 (`automation.screen_capture`)
- **InputHandler**: 마우스 클릭 입력 (`automation.input_handler`)
- **OpenCV (cv2)**: 이미지 템플릿 매칭

#### 코드 예시

```python
@NodeExecutor("image-touch")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 폴더 경로 추출
    folder_path = get_parameter(parameters, "folder_path", default="")
    
    # timeout 파라미터 추출 및 검증
    timeout_param = get_parameter(parameters, "timeout", default=None)
    timeout = None
    if timeout_param is not None:
        timeout = float(timeout_param)
        if timeout <= 0:
            timeout = None
    
    # 이미지 파일 수집 (이름 순서대로 정렬)
    image_files = []
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if os.path.isfile(file_path):
            _, ext = os.path.splitext(filename.lower())
            if ext in image_extensions:
                image_files.append(file_path)
    image_files.sort()
    
    # 화면 캡처 및 입력 핸들러 초기화
    screen_capture = ScreenCapture()
    input_handler = InputHandler()
    
    # 각 이미지에 대해 검색 및 터치
    results = []
    for image_path in image_files:
        try:
            # 화면에서 이미지 찾기 (threshold=0.7)
            location = screen_capture.find_template(image_path, threshold=0.7, timeout=timeout)
            
            if location:
                # location에서 좌표와 크기 추출 (x, y, width, height)
                x, y, w, h = location
                # 이미지 중심점 계산
                center_x = x + w // 2
                center_y = y + h // 2
                
                # 중심점 위치를 터치
                success = input_handler.click(center_x, center_y)
                
                results.append({
                    "image": os.path.basename(image_path),
                    "found": True,
                    "position": (center_x, center_y),
                    "touched": success
                })
            else:
                results.append({
                    "image": os.path.basename(image_path),
                    "found": False,
                    "message": "화면에서 이미지를 찾을 수 없습니다."
                })
        except Exception as e:
            # 예외 발생 시 에러 정보 추가
            results.append({
                "image": os.path.basename(image_path),
                "error": str(e)
            })
    
    # 성공 여부 판단: 하나라도 이미지를 찾아서 터치했으면 성공
    success = any(r.get("found", False) and r.get("touched", False) for r in results)
    
    return {
        "action": "image-touch",
        "status": "completed" if success else "failed",
        "output": {
            "success": success,
            "folder_path": folder_path,
            "total_images": len(image_files),
            "results": results
        }
    }
```

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│              이미지 터치 노드 실행 흐름                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  1. 폴더 경로 검증                                │  │
│  │     - folder_path 확인                            │  │
│  │     - 폴더 존재 여부 확인                          │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  2. 이미지 파일 수집                               │  │
│  │     - 폴더 내 이미지 파일 스캔                     │  │
│  │     - 지원 확장자 필터링 (.png, .jpg 등)          │  │
│  │     - 파일 이름 순서대로 정렬                      │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  3. 화면 캡처 및 핸들러 초기화                     │  │
│  │     ScreenCapture() - 화면 캡처 객체               │  │
│  │     InputHandler() - 입력 제어 객체                │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  4. 각 이미지에 대해 반복 처리                     │  │
│  │     ┌──────────────────────────────────────────┐ │  │
│  │     │ 4-1. 화면에서 이미지 찾기                │ │  │
│  │     │     ScreenCapture.find_template()        │ │  │
│  │     │     - OpenCV 템플릿 매칭 사용              │ │  │
│  │     │     - threshold=0.7 설정                  │ │  │
│  │     │     - 타임아웃 설정 가능                  │ │  │
│  │     │     - location 반환: (x, y, w, h) 또는 None│ │  │
│  │     └──────────────┬───────────────────────────┘ │  │
│  │                    │                              │  │
│  │                    ▼                              │  │
│  │     ┌──────────────────────────────────────────┐ │  │
│  │     │ 4-2. 이미지 찾기 성공 시 중심점 계산 및 터치│ │  │
│  │     │     - location에서 (x, y, w, h) 추출      │ │  │
│  │     │     - 중심점 계산: (x + w//2, y + h//2)   │ │  │
│  │     │     - InputHandler.click(center_x, center_y)│ │  │
│  │     │     - 클릭 성공 여부 반환                  │ │  │
│  │     └──────────────┬───────────────────────────┘ │  │
│  │                    │                              │  │
│  │                    ▼                              │  │
│  │     ┌──────────────────────────────────────────┐ │  │
│  │     │ 4-3. 결과 기록                            │ │  │
│  │     │     - 찾음: {image, found, position, touched}│ │  │
│  │     │     - 못 찾음: {image, found, message}   │ │  │
│  │     │     - 에러: {image, error}                │ │  │
│  │     └──────────────────────────────────────────┘ │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  5. 최종 결과 반환                                 │  │
│  │     {success, folder_path, total_images, results} │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              외부 의존성 (automation)                    │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ScreenCapture    │  │ InputHandler     │           │
│  │                  │  │                  │           │
│  │ - capture()      │  │ - click(x, y)    │           │
│  │ - find_template()│  │ - type()         │           │
│  │                  │  │ - press_key()    │           │
│  └──────────────────┘  └──────────────────┘           │
│                                                          │
│  OpenCV (cv2) - 이미지 템플릿 매칭                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 특징

1. **순차 처리**: 이미지 파일들을 이름 순서대로 처리합니다
2. **템플릿 매칭**: OpenCV의 템플릿 매칭 알고리즘을 사용하여 정확한 이미지 검색을 수행합니다 (threshold=0.7)
3. **중심점 계산**: 찾은 이미지의 중심점을 계산하여 정확한 위치를 터치합니다
4. **타임아웃 지원**: 각 이미지 검색에 타임아웃을 설정할 수 있습니다 (선택 사항)
5. **상세한 결과**: 각 이미지에 대한 검색 및 터치 결과를 상세히 반환합니다
6. **에러 처리**: 폴더가 없거나 이미지 파일이 없는 경우, 또는 이미지 처리 중 오류 발생 시 적절한 에러 메시지를 반환합니다
7. **성공 판단**: 하나라도 이미지를 찾아서 터치했으면 전체 작업이 성공으로 간주됩니다

## 사용 예시

### 워크플로우 예시

```
[시작] → [이미지 터치] → [대기] → [클릭]
         (폴더: C:\images\buttons)
```

이 워크플로우는:
1. 시작 노드로 워크플로우를 시작합니다
2. 이미지 터치 노드가 `C:\images\buttons` 폴더의 이미지들을 화면에서 찾아 터치합니다
3. 대기 노드로 잠시 대기합니다
4. 클릭 노드로 추가 작업을 수행합니다

### 파라미터 설정 예시

```json
{
  "folder_path": "C:\\images\\touch",
  "timeout": 30
}
```

## 주의사항

1. **Windows 환경**: 현재 Windows 환경에서만 동작합니다
2. **이미지 품질**: 이미지 파일의 품질이 좋을수록 검색 정확도가 높아집니다
3. **화면 해상도**: 화면 해상도가 변경되면 이미지 매칭이 실패할 수 있습니다
4. **파일 이름 순서**: 이미지 파일들은 알파벳 순서대로 처리됩니다
