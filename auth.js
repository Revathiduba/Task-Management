// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
    apiKey: "AIzaSyA-IyNrfeIOvun4tr2kwYBl8UvTawNnTgI",
    authDomain: "teamwork-d3e90.firebaseapp.com",
    projectId: "teamwork-d3e90",
    storageBucket: "teamwork-d3e90.firebasestorage.app",
    messagingSenderId: "518076377708",
    appId: "1:518076377708:web:118aaeeb8511c3b71a4649",
    measurementId: "G-94NPPK5ENR"
};

// Initialize Firebase if not already initialized
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

console.log("Auth module loaded");

// ===== AUTHENTICATION FUNCTIONS =====
class AuthManager {
    constructor() {
        console.log("Auth manager constructor called");
        // Check if we're on login or signup page
        const isLoginPage = window.location.href.includes('login.html');
        const isSignupPage = window.location.href.includes('signup.html');
        
        // Check if user is already logged in
        auth.onAuthStateChanged(user => {
            console.log("Auth state changed:", user ? "logged in" : "not logged in");
            if (user) {
                // If user is logged in and on auth pages, redirect to main app
                if (isLoginPage || isSignupPage) {
                    window.location.href = 'index.html';
                }
            }
        });
        
        // Setup event listeners based on current page
        if (isLoginPage) {
            console.log("Setting up login page listeners");
            this.setupLoginListeners();
        } else if (isSignupPage) {
            console.log("Setting up signup page listeners");
            this.setupSignupListeners();
        }
    }
    
    setupLoginListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            console.log("Login form found, attaching event listener");
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log("Login form submitted");
                this.handleLogin();
            });
            
            // Also add click handler directly to button as a fallback
            const loginButton = document.querySelector('.btn-auth');
            if (loginButton) {
                loginButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log("Login button clicked");
                    this.handleLogin();
                });
            }
        } else {
            console.error("Login form not found in the DOM");
        }
    }
    
    setupSignupListeners() {
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
            
            // Add password match validation
            const confirmPassword = document.getElementById('signup-confirm-password');
            if (confirmPassword) {
                confirmPassword.addEventListener('input', () => {
                    this.validatePasswordMatch();
                });
            }
            
            // Add email validation
            const emailInput = document.getElementById('signup-email');
            if (emailInput) {
                emailInput.addEventListener('blur', () => {
                    this.validateEmail(emailInput.value);
                });
            }
        }
    }
    
    validatePasswordMatch() {
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password');
        const passwordGroup = confirmPassword.closest('.form-group');
        const errorMsg = passwordGroup.querySelector('.validation-message');
        
        if (password !== confirmPassword.value) {
            passwordGroup.classList.add('error');
            errorMsg.textContent = 'Passwords do not match';
        } else {
            passwordGroup.classList.remove('error');
            errorMsg.textContent = '';
        }
    }
    
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailInput = document.getElementById('signup-email');
        const emailGroup = emailInput.closest('.form-group');
        const errorMsg = emailGroup.querySelector('.validation-message');
        
        if (!emailRegex.test(email)) {
            emailGroup.classList.add('error');
            errorMsg.textContent = 'Please enter a valid email address';
            return false;
        } else {
            emailGroup.classList.remove('error');
            errorMsg.textContent = '';
            return true;
        }
    }
    
    async handleLogin() {
        console.log("Handling login");
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDisplay = document.getElementById('login-error');
        
        if (!email || !password) {
            this.showError(errorDisplay, 'Please fill in all fields');
            return;
        }
        
        try {
            console.log("Attempting login with:", email);
            // Show loading state
            this.setButtonLoading(true, 'Login');
            
            // Authenticate with Firebase
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log("Login successful:", userCredential.user.uid);
            
            // Wait a brief moment to show success before redirecting
            this.showToast('Login successful! Redirecting...', 'success');
            
            // Redirect to main app after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            
            // Display user-friendly error message
            let errorMessage = 'Failed to login. Please try again.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later.';
            }
            
            this.showError(errorDisplay, errorMessage);
            this.setButtonLoading(false, 'Login');
        }
    }
    
    async handleSignup() {
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const errorDisplay = document.getElementById('signup-error');
        
        // Clear previous errors
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
        
        // Basic validation
        if (!username || !email || !password || !confirmPassword) {
            this.showError(errorDisplay, 'Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError(errorDisplay, 'Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError(errorDisplay, 'Password must be at least 6 characters');
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showError(errorDisplay, 'Please enter a valid email address');
            return;
        }
        
        try {
            // Show loading state
            this.setButtonLoading(true, 'Sign Up');
            
            // Create user in Firebase Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log("User created:", user);
            
            // Create user profile in Firestore
            await db.collection('users').doc(user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log("User profile created in Firestore");
            
            // Create initial notes document for the user
            await db.collection('notes').doc(user.uid).set({
                content: 'Welcome to TaskFlow! This is your personal notepad.',
                attachments: [],
                userId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log("Initial notes created");
            
            // Show success message
            this.showSuccessMessage('Sign up successful! Redirecting to dashboard...');
            
            // Redirect to main app after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            
            // Display user-friendly error message
            let errorMessage = 'Failed to create account. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email is already in use';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            }
            
            this.showError(errorDisplay, errorMessage);
            this.setButtonLoading(false, 'Sign Up');
        }
    }
    
    showError(element, message) {
        if (!element) {
            console.error("Error element not found");
            return;
        }
        element.textContent = message;
        element.style.display = 'block';
        element.style.opacity = '1';
    }
    
    showSuccessMessage(message) {
        // Create a success message element if it doesn't exist
        let successElement = document.getElementById('signup-success');
        
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.id = 'signup-success';
            successElement.className = 'auth-success';
            
            // Insert after the form
            const form = document.getElementById('signup-form');
            if (form) {
                form.parentNode.insertBefore(successElement, form.nextSibling);
            }
        }
        
        successElement.textContent = message;
        successElement.style.display = 'block';
        successElement.style.opacity = '1';
        
        // Also show toast
        this.showToast(message, 'success');
    }
    
    setButtonLoading(isLoading, type) {
        const button = document.querySelector('.btn-auth');
        if (!button) {
            console.error("Auth button not found");
            return;
        }
        
        if (isLoading) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            button.disabled = true;
        } else {
            button.innerHTML = type === 'Login' 
                ? '<i class="fas fa-sign-in-alt"></i> Login'
                : '<i class="fas fa-user-plus"></i> Create Account';
            button.disabled = false;
        }
    }
    
    showToast(message, type = 'info') {
        // Check if there's a toast container
        let toast = document.getElementById('toast');
        
        // If no toast container, create one
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            
            const toastContent = document.createElement('div');
            toastContent.className = 'toast-content';
            
            const icon = document.createElement('i');
            icon.className = 'toast-icon';
            
            const messageSpan = document.createElement('span');
            messageSpan.className = 'toast-message';
            
            toastContent.appendChild(icon);
            toastContent.appendChild(messageSpan);
            toast.appendChild(toastContent);
            
            document.body.appendChild(toast);
        }
        
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        
        // Set message and type
        toastMessage.textContent = message;
        toast.className = `toast show ${type}`;
        
        // Set icon based on type
        switch (type) {
            case 'success':
                toastIcon.className = 'toast-icon fas fa-check-circle';
                break;
            case 'error':
                toastIcon.className = 'toast-icon fas fa-exclamation-circle';
                break;
            case 'info':
                toastIcon.className = 'toast-icon fas fa-info-circle';
                break;
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the auth manager when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing auth manager");
    window.authManager = new AuthManager();
});
