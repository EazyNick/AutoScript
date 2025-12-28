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
- `timeout` (number, 기본값: 30): 이미지를 찾을 때까지 대기할 최대 시간 (초)

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
        "position": [100, 200],
        "touched": true
      },
      {
        "image": "image2.png",
        "found": false,
        "position": null,
        "touched": false
      },
      {
        "image": "image3.png",
        "found": true,
        "position": [300, 400],
        "touched": true
      }
    ]
  }
}
```

#### 동작 방식

1. **폴더 경로 검증**: 폴더 경로가 제공되었는지 확인하고, 폴더가 존재하는지 확인합니다
2. **이미지 파일 수집**: 폴더 내의 지원하는 이미지 파일들을 찾습니다
   - 지원 확장자: `.png`, `.jpg`, `.jpeg`, `.bmp`, `.gif`, `.tiff`, `.webp`
   - 파일 이름 순서대로 정렬됩니다
3. **화면 캡처**: 현재 화면을 캡처합니다 (`ScreenCapture`)
4. **이미지 검색 및 터치**: 각 이미지 파일에 대해:
   - 화면에서 이미지를 찾습니다 (`find_template` - OpenCV 템플릿 매칭)
   - 이미지를 찾으면 해당 위치를 터치합니다 (`InputHandler.click`)
   - 결과를 기록합니다
5. **결과 반환**: 모든 이미지에 대한 검색 및 터치 결과를 반환합니다

#### 의존성

- **ScreenCapture**: 화면 캡처 및 이미지 찾기 (`automation_utils.screen_capture`)
- **InputHandler**: 마우스 클릭 입력 (`automation_utils.input_handler`)
- **OpenCV (cv2)**: 이미지 템플릿 매칭

#### 코드 예시

```python
@NodeExecutor("image-touch")
async def execute(parameters: dict[str, Any]) -> dict[str, Any]:
    # 폴더 경로 추출
    folder_path = get_parameter(parameters, "folder_path", default="")
    
    # 이미지 파일 수집
    image_files = []
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if os.path.isfile(file_path):
            _, ext = os.path.splitext(filename.lower())
            if ext in image_extensions:
                image_files.append(file_path)
    
    # 화면 캡처 및 입력 핸들러 초기화
    screen_capture = ScreenCapture()
    input_handler = InputHandler()
    
    # 각 이미지에 대해 검색 및 터치
    results = []
    for image_path in image_files:
        # 화면에서 이미지 찾기
        position = screen_capture.find_template(image_path, timeout=timeout)
        
        if position:
            # 이미지를 찾으면 터치
            input_handler.click(position[0], position[1])
            results.append({
                "image": os.path.basename(image_path),
                "found": True,
                "position": position,
                "touched": True
            })
        else:
            results.append({
                "image": os.path.basename(image_path),
                "found": False,
                "position": None,
                "touched": False
            })
    
    return {
        "action": "image-touch",
        "status": "completed",
        "output": {
            "success": True,
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
│  │     │     - 타임아웃 설정 가능                  │ │  │
│  │     └──────────────┬───────────────────────────┘ │  │
│  │                    │                              │  │
│  │                    ▼                              │  │
│  │     ┌──────────────────────────────────────────┐ │  │
│  │     │ 4-2. 이미지 찾기 성공 시 터치             │ │  │
│  │     │     InputHandler.click(x, y)              │ │  │
│  │     │     - 찾은 위치 좌표로 클릭                │ │  │
│  │     └──────────────┬───────────────────────────┘ │  │
│  │                    │                              │  │
│  │                    ▼                              │  │
│  │     ┌──────────────────────────────────────────┐ │  │
│  │     │ 4-3. 결과 기록                            │ │  │
│  │     │     {image, found, position, touched}     │ │  │
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
│              외부 의존성 (automation_utils)              │
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
2. **템플릿 매칭**: OpenCV의 템플릿 매칭 알고리즘을 사용하여 정확한 이미지 검색을 수행합니다
3. **타임아웃 지원**: 각 이미지 검색에 타임아웃을 설정할 수 있습니다
4. **상세한 결과**: 각 이미지에 대한 검색 및 터치 결과를 상세히 반환합니다
5. **에러 처리**: 폴더가 없거나 이미지 파일이 없는 경우 적절한 에러 메시지를 반환합니다

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
