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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== AUTHENTICATION FUNCTIONS =====
class AuthManager {
    constructor() {
        // Check if we're on login or signup page
        const isLoginPage = window.location.href.includes('login.html');
        const isSignupPage = window.location.href.includes('signup.html');
        
        // Check if user is already logged in
        auth.onAuthStateChanged(user => {
            if (user) {
                // If user is logged in and on auth pages, redirect to main app
                if (isLoginPage || isSignupPage) {
                    window.location.href = 'index.html';
                }
            }
        });
        
        // Setup event listeners based on current page
        if (isLoginPage) {
            this.setupLoginListeners();
        } else if (isSignupPage) {
            this.setupSignupListeners();
        }
    }
    
    setupLoginListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }
    
    setupSignupListeners() {
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }
    }
    
    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDisplay = document.getElementById('login-error');
        
        if (!email || !password) {
            this.showError(errorDisplay, 'Please fill in all fields');
            return;
        }
        
        try {
            // Show loading state
            this.setButtonLoading(true, 'Login');
            
            // Authenticate with Firebase
            await auth.signInWithEmailAndPassword(email, password);
            
            // Redirect to main app
            window.location.href = 'index.html';
            
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
        
        try {
            // Show loading state
            this.setButtonLoading(true, 'Sign Up');
            
            // Create user in Firebase Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user profile in Firestore
            await db.collection('users').doc(user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Create initial notes document for the user
            await db.collection('notes').doc(user.uid).set({
                content: 'Welcome to TaskFlow! This is your personal notepad.',
                attachments: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Redirect to main app
            window.location.href = 'index.html';
            
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
            }
            
            this.showError(errorDisplay, errorMessage);
            this.setButtonLoading(false, 'Sign Up');
        }
    }
    
    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.opacity = '1';
        }, 10);
    }
    
    setButtonLoading(isLoading, type) {
        const button = document.querySelector('.btn-auth');
        if (!button) return;
        
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
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        
        // Set message and type
        toastMessage.textContent = message;
        toast.className = `toast show ${type}`;
        
        // Set icon based on type
        switch (type) {
            case 'success':
                toastIcon.className = 'fas fa-check-circle';
                break;
            case 'error':
                toastIcon.className = 'fas fa-exclamation-circle';
                break;
            case 'info':
                toastIcon.className = 'fas fa-info-circle';
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

// Initialize the auth manager
const authManager = new AuthManager();
