from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.models.models import Usuario, Estudio
from app.schemas.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, RefreshRequest, UsuarioOut
)
import uuid

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Verificar email único
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El email ya está registrado")

    # Crear estudio
    estudio = Estudio(
        nombre=data.nombre_estudio,
        plan="starter",
        limite_comprobantes_mes=300,
    )
    db.add(estudio)
    await db.flush()

    # Crear usuario
    usuario = Usuario(
        estudio_id=estudio.id,
        nombre=data.nombre_usuario,
        email=data.email,
        password_hash=hash_password(data.password),
        rol="admin",
    )
    db.add(usuario)
    await db.flush()

    token_data = {"sub": str(usuario.id), "estudio_id": str(estudio.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        usuario=UsuarioOut.model_validate(usuario),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    usuario = result.scalar_one_or_none()

    if not usuario or not usuario.password_hash:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not verify_password(data.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Cuenta deshabilitada")

    token_data = {"sub": str(usuario.id), "estudio_id": str(usuario.estudio_id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        usuario=UsuarioOut.model_validate(usuario),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresh inválido")

    user_id = payload.get("sub")
    result = await db.execute(select(Usuario).where(Usuario.id == uuid.UUID(user_id)))
    usuario = result.scalar_one_or_none()
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    token_data = {"sub": str(usuario.id), "estudio_id": str(usuario.estudio_id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        usuario=UsuarioOut.model_validate(usuario),
    )
