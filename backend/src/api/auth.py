"""Auth endpoints — register, login, refresh, verify, password reset."""

from fastapi import APIRouter, HTTPException, status

from src.api.deps import CurrentUser, DB
from src.schemas.auth import (
    PasswordReset,
    PasswordResetRequest,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegister,
)
from src.services import auth_service

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: DB):
    try:
        user = await auth_service.register_user(
            db,
            username=body.username,
            email=body.email,
            full_name=body.full_name,
            password=body.password,
        )
        return {"id": str(user.id), "username": user.username, "email": user.email}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: DB):
    result = await auth_service.authenticate_user(db, body.identifier, body.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    access_token, refresh_token = result
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: TokenRefresh, db: DB):
    result = await auth_service.refresh_tokens(db, body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    access_token, refresh_token = result
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/verify")
async def verify(current_user: CurrentUser):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: PasswordResetRequest, db: DB):
    # TODO: Implement OTP generation + email sending
    return {"message": "If an account with that email exists, an OTP has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: PasswordReset, db: DB):
    # TODO: Implement OTP verification + password reset
    return {"message": "Password has been reset successfully."}
