"""
프로세스 포커스 관련 모델
"""

from typing import Any

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class ProcessFocusParams(BaseModel):
    """프로세스 포커스 파라미터 모델"""

    process_id: int | None = Field(None, description="프로세스 ID")
    hwnd: int | None = Field(None, description="창 핸들 (Window Handle)")

    @field_validator("process_id", "hwnd")
    @classmethod
    def validate_at_least_one(cls: type["ProcessFocusParams"], v: int | None, _info: ValidationInfo) -> int | None:
        """process_id 또는 hwnd 중 하나는 필수"""
        # 이 검증은 모델 레벨에서 수행
        return v

    @field_validator("process_id", "hwnd", mode="before")
    @classmethod
    def validate_values(cls: type["ProcessFocusParams"], v: Any) -> int | None:
        """값 검증"""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                raise ValueError(f"정수로 변환할 수 없습니다: {v}")
        if isinstance(v, int):
            return v
        return None

    def model_post_init(self: "ProcessFocusParams", __context: Any) -> None:
        """모델 초기화 후 검증: process_id 또는 hwnd 중 하나는 필수"""
        if not self.process_id and not self.hwnd:
            raise ValueError("process_id 또는 hwnd 중 하나는 필수입니다.")
