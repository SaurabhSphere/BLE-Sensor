from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, Token, ForgotPasswordRequest, ResetPasswordRequest
from app.security import get_password_hash, verify_password, create_access_token, generate_random_token
from app.services.email import send_verification_email, send_password_reset_email
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: UserCreate, 
    background_tasks: BackgroundTasks, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Register a new inactive user and send a verification email."""
    # Check if username exists
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered."
        )
    
    # Check if email exists
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered."
        )
    
    # Create user object
    hashed_password = get_password_hash(user_in.password)
    verification_token = generate_random_token()
    
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        is_active=False,
        is_verified=False,
        is_superuser=False,
        verification_token=verification_token
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send verification email in the background
    # Verification URL targets the backend verify-email GET endpoint
    verification_url = f"{request.base_url}api/auth/verify-email?token={verification_token}"
    background_tasks.add_task(
        send_verification_email, 
        to_email=new_user.email, 
        username=new_user.username, 
        verification_url=verification_url
    )
    
    return new_user


@router.get("/verify-email", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """GET endpoint to verify a user's email address using a token."""
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        return """
        <html>
            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <div style="max-width: 500px; margin: auto; padding: 30px; border: 1px solid #ffcccc; border-radius: 8px; background-color: #fff5f5;">
                    <h2 style="color: #d9534f;">❌ Email Verification Failed</h2>
                    <p style="color: #666;">The verification token is invalid or has expired.</p>
                </div>
            </body>
        </html>
        """
    
    # Update user status
    user.is_verified = True
    user.is_active = True
    user.verification_token = None
    db.commit()
    
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
            <div style="max-width: 500px; margin: auto; padding: 30px; border: 1px solid #d6e9c6; border-radius: 8px; background-color: #fcf8e3;">
                <h2 style="color: #3c763d;">✓ Email Verified Successfully!</h2>
                <p style="color: #666;">Hello {user.username}, your email address has been verified. You can now log into the application.</p>
                <div style="margin-top: 20px;">
                    <a href="{settings.FRONTEND_URL}" style="background-color: #3c763d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
                </div>
            </div>
        </body>
    </html>
    """


@router.post("/login", response_model=Token)
def login_for_access_token(
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Authenticate a user via username or email and return a JWT access token."""
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username, email, or password"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email to activate your account."
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """Generate a password reset token and send reset link to the user."""
    user = db.query(User).filter(User.email == request.email).first()
    if user:
        reset_token = generate_random_token()
        user.reset_token = reset_token
        db.commit()
        
        # Reset URL points to the frontend page where user enters new password
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        background_tasks.add_task(
            send_password_reset_email,
            to_email=user.email,
            username=user.username,
            reset_url=reset_url
        )
        
    # We return success message anyway to prevent email harvesting/enumeration
    return {"message": "If the email is registered, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset a user's password using the token sent to their email."""
    user = db.query(User).filter(User.reset_token == request.token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )
        
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    db.commit()
    
    return {"message": "Password has been reset successfully."}
