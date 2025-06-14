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
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// ===== CLOUDINARY CONFIGURATION =====
const CLOUDINARY_CONFIG = {
    cloudName: 'dsbne4rlh',
    uploadPreset: 'Teamwork'
};

// ===== APPLICATION STATE =====
class TaskManager {
    constructor() {
        this.tasks = [];
        this.notes = '';
        this.currentFilter = 'all';
        this.currentTab = 'tasks';
        this.editingTask = null;
        this.searchQuery = '';
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.autoSaveTimeout = null;
        this.currentAttachment = null;
        this.currentNoteMedia = null;
        this.currentUser = null;
        
        this.checkAuth();
    }

    checkAuth() {
        // Show loading screen
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('main-container').classList.add('hidden');
        
        // Listen for auth state changes
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in
                this.currentUser = user;
                this.getUserProfile();
                this.init();
            } else {
                // User is signed out, redirect to login
                window.location.href = 'login.html';
            }
        });
    }
    
    async getUserProfile() {
        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                // Update UI with user info
                this.updateUserUI();
            }
        } catch (error) {
            console.error('Error getting user profile:', error);
        }
    }
    
    updateUserUI() {
        const welcomeTitle = document.getElementById('welcome-title');
        if (welcomeTitle && this.userProfile) {
            welcomeTitle.textContent = `Welcome back, ${this.userProfile.username}!`;
        }
        
        // Add user info to header
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            // Remove existing user button if it exists to avoid duplicates
            const existingUserButton = document.querySelector('.user-button');
            if (existingUserButton) {
                existingUserButton.remove();
            }
            
            const userButton = document.createElement('div');
            userButton.className = 'user-button';
            userButton.innerHTML = `
                <span>${this.userProfile.username || 'User'}</span>
                <button id="logout-btn" class="logout-btn" title="Logout">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            `;
            headerActions.prepend(userButton);
            
            // Add logout handler
            document.getElementById('logout-btn').addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }
    
    async handleLogout() {
        try {
            // Show loading state
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                logoutBtn.disabled = true;
            }
            
            this.showToast('Logging out...', 'info');
            
            // Clear any cached data
            this.tasks = [];
            this.notes = '';
            localStorage.removeItem('currentTab');
            
            // Sign out from Firebase
            await auth.signOut();
            
            // Show success message before redirecting
            this.showToast('Logout successful!', 'success');
            
            // Add a small delay to show the success message
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } catch (error) {
            console.error('Error signing out:', error);
            
            // Reset logout button state
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                logoutBtn.disabled = false;
            }
            
            this.showToast('Failed to log out. Please try again.', 'error');
        }
    }

    async init() {
        try {
            this.setupEventListeners();
            this.setupTheme();
            this.displayCurrentDate();
            this.displayMotivationalQuote();
            
            // Load data from Firebase for current user
            await this.loadTasks();
            await this.loadNotes();
            
            this.hideLoading();
            this.showToast('Welcome back! Your data has been loaded.', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            this.hideLoading();
            this.showToast('Failed to load data. Please refresh the page.', 'error');
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Find the element with the data-tab attribute (button or its parent)
                let element = e.target;
                while (element && !element.dataset.tab) {
                    element = element.parentElement;
                }
                
                if (element && element.dataset.tab) {
                    console.log(`Switching to tab: ${element.dataset.tab}`);
                    this.switchTab(element.dataset.tab);
                } else {
                    console.error('Tab button clicked but no data-tab attribute found!', e.target);
                }
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Find the element with the data-filter attribute (button or its parent)
                let element = e.target;
                while (element && !element.dataset.filter) {
                    element = element.parentElement;
                }
                
                if (element && element.dataset.filter) {
                    this.setFilter(element.dataset.filter);
                } else {
                    console.error('Filter button clicked but no data-filter attribute found!', e.target);
                }
            });
        });

        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTasks();
        });

        // FAB button
        document.getElementById('fab').addEventListener('click', () => {
            this.openTaskModal();
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Task modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeTaskModal();
        });
        
        document.getElementById('cancel-task').addEventListener('click', () => {
            this.closeTaskModal();
        });

        // Task form
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // File upload
        document.getElementById('file-upload-area').addEventListener('click', () => {
            document.getElementById('task-attachment').click();
        });

        document.getElementById('task-attachment').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'task');
        });

        // Drag and drop
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0], 'task');
            }
        });

        // Notepad functionality
        document.getElementById('notepad-content').addEventListener('input', (e) => {
            this.notes = e.target.value;
            this.autoSaveNotes();
        });

        document.getElementById('attach-note-media').addEventListener('click', () => {
            this.openMediaModal();
        });

        // Media modal
        document.getElementById('media-modal-close').addEventListener('click', () => {
            this.closeMediaModal();
        });

        document.getElementById('cancel-media').addEventListener('click', () => {
            this.closeMediaModal();
        });

        document.getElementById('save-media').addEventListener('click', () => {
            this.saveNoteMedia();
        });

        document.getElementById('media-upload-area').addEventListener('click', () => {
            document.getElementById('media-attachment').click();
        });

        document.getElementById('media-attachment').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'media');
        });

        // Modal backdrop clicks
        document.getElementById('task-modal').addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                this.closeTaskModal();
            }
        });

        document.getElementById('media-modal').addEventListener('click', (e) => {
            if (e.target.id === 'media-modal') {
                this.closeMediaModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.openTaskModal();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveNotes();
                        break;
                    case '/':
                        e.preventDefault();
                        document.getElementById('search-input').focus();
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeMediaModal();
            }
        });
    }

    setupTheme() {
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        }
        
        this.showToast(`Switched to ${this.isDarkMode ? 'dark' : 'light'} mode`, 'info');
    }

    displayCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
    }

    displayMotivationalQuote() {
        const quotes = [
            "The secret of getting ahead is getting started.",
            "Success is not final, failure is not fatal: it is the courage to continue that counts.",
            "The way to get started is to quit talking and begin doing.",
            "Don't watch the clock; do what it does. Keep going.",
            "The future depends on what you do today.",
            "It always seems impossible until it's done.",
            "The only way to do great work is to love what you do."
        ];
        
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        document.getElementById('motivational-quote').textContent = `"${randomQuote}"`;
    }

    hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-container').classList.remove('hidden');
    }

    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const tabButton = document.querySelector(`[data-tab="${tab}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        } else {
            console.warn(`Tab button with data-tab="${tab}" not found`);
        }

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const tabSection = document.getElementById(`${tab}-section`);
        if (tabSection) {
            tabSection.classList.add('active');
        } else {
            console.warn(`Tab section with id="${tab}-section" not found`);
        }

        this.currentTab = tab;
    }

    setFilter(filter) {
        if (!filter) {
            console.error('Invalid filter value:', filter);
            return;
        }
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const filterButton = document.querySelector(`[data-filter="${filter}"]`);
        if (filterButton) {
            filterButton.classList.add('active');
        } else {
            console.warn(`Filter button with data-filter="${filter}" not found`);
        }

        this.currentFilter = filter;
        this.renderTasks();
    }

    // ===== TASK MANAGEMENT =====
    async loadTasks() {
        try {
            if (!this.currentUser) return;
            
            const snapshot = await db.collection('tasks')
                .where('userId', '==', this.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .get();
                
            this.tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showToast('Failed to load tasks', 'error');
        }
    }

    async saveTask() {
        if (!this.validateTaskForm()) return;
        if (!this.currentUser) {
            this.showToast('You must be logged in to save tasks', 'error');
            return;
        }

        const formData = new FormData(document.getElementById('task-form'));
        const taskData = {
            title: formData.get('title') || document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            deadline: document.getElementById('task-deadline').value,
            priority: document.getElementById('task-priority').value,
            completed: false,
            attachment: this.currentAttachment || null,
            userId: this.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            this.setSyncStatus('syncing');
            
            if (this.editingTask) {
                await db.collection('tasks').doc(this.editingTask.id).update({
                    ...taskData,
                    userId: this.currentUser.uid, // Ensure userId is set
                    createdAt: this.editingTask.createdAt // Preserve original creation date
                });
                this.showToast('Task updated successfully!', 'success');
            } else {
                await db.collection('tasks').add(taskData);
                this.showToast('Task created successfully!', 'success');
            }

            await this.loadTasks();
            this.closeTaskModal();
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error saving task:', error);
            this.showToast('Failed to save task', 'error');
            this.setSyncStatus('error');
        }
    }

    validateTaskForm() {
        const title = document.getElementById('task-title').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        
        let isValid = true;

        // Validate title
        if (!title) {
            this.showFieldError('task-title', 'Please enter a task title');
            isValid = false;
        } else {
            this.hideFieldError('task-title');
        }

        // Validate deadline
        if (!deadline) {
            this.showFieldError('task-deadline', 'Please set a deadline');
            isValid = false;
        } else {
            this.hideFieldError('task-deadline');
        }

        // Check for duplicate titles on same date
        if (title && deadline) {
            const deadlineDate = new Date(deadline).toDateString();
            const duplicate = this.tasks.find(task => 
                task.title.toLowerCase() === title.toLowerCase() && 
                new Date(task.deadline).toDateString() === deadlineDate &&
                (!this.editingTask || task.id !== this.editingTask.id)
            );
            
            if (duplicate) {
                this.showFieldError('task-title', 'A task with this title already exists on the same date');
                isValid = false;
            }
        }

        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const group = field.closest('.form-group');
        const errorMsg = group.querySelector('.validation-message');
        
        group.classList.add('error');
        errorMsg.textContent = message;
    }

    hideFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const group = field.closest('.form-group');
        group.classList.remove('error');
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            this.setSyncStatus('syncing');
            await db.collection('tasks').doc(taskId).delete();
            await this.loadTasks();
            this.showToast('Task deleted successfully!', 'success');
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showToast('Failed to delete task', 'error');
            this.setSyncStatus('error');
        }
    }

    async toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            this.setSyncStatus('syncing');
            await db.collection('tasks').doc(taskId).update({
                completed: !task.completed,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.loadTasks();
            this.showToast(`Task marked as ${!task.completed ? 'completed' : 'pending'}`, 'success');
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showToast('Failed to update task status', 'error');
            this.setSyncStatus('error');
        }
    }

    openTaskModal(task = null) {
        this.editingTask = task;
        this.currentAttachment = task ? task.attachment : null;
        
        const modal = document.getElementById('task-modal');
        const modalTitle = document.getElementById('modal-title');
        const saveButton = document.getElementById('save-task');
        
        // Clear form
        document.getElementById('task-form').reset();
        document.getElementById('attachment-preview').innerHTML = '';
        
        if (task) {
            // Fill form with task data
            document.getElementById('task-title').value = task.title || '';
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-deadline').value = this.formatDateForInput(task.deadline);
            document.getElementById('task-priority').value = task.priority || 'medium';
            
            // Update UI elements
            modalTitle.textContent = 'Edit Task';
            saveButton.innerHTML = '<i class="fas fa-save"></i> Update Task';
            
            // Show attachment preview if exists
            if (task.attachment) {
                this.renderAttachmentPreview(task.attachment, 'task');
            }
        } else {
            // Set default values for new task
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(12, 0, 0, 0);
            
            document.getElementById('task-deadline').value = this.formatDateForInput(tomorrow);
            
            // Update UI elements
            modalTitle.textContent = 'Add New Task';
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save Task';
        }
        
        // Show modal
        modal.classList.add('show');
        document.getElementById('task-title').focus();
    }

    closeTaskModal() {
        document.getElementById('task-modal').classList.remove('show');
        this.editingTask = null;
        this.currentAttachment = null;
    }
    
    formatDateForInput(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async handleFileUpload(file, type) {
        if (!file) return;
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File is too large. Maximum size is 5MB', 'error');
            return;
        }

        // Validate file type
        if (!file.type.match('image.*') && !file.type.match('video.*')) {
            this.showToast('Only image and video files are supported', 'error');
            return;
        }
        
        try {
            // Show loading state
            this.setSyncStatus('syncing');
            
            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            const attachmentData = {
                url: data.secure_url,
                publicId: data.public_id,
                type: file.type.includes('image') ? 'image' : 'video',
                name: file.name
            };
            
            // Update state based on upload type
            if (type === 'task') {
                this.currentAttachment = attachmentData;
                this.renderAttachmentPreview(attachmentData, 'task');
            } else if (type === 'media') {
                this.currentNoteMedia = attachmentData;
                this.renderAttachmentPreview(attachmentData, 'media');
            }
            
            this.setSyncStatus('synced');
            this.showToast('File uploaded successfully!', 'success');
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showToast('Failed to upload file', 'error');
            this.setSyncStatus('error');
        }
    }

    renderAttachmentPreview(attachment, type) {
        if (!attachment) return;
        
        const container = type === 'task' 
            ? document.getElementById('attachment-preview')
            : document.getElementById('media-preview');
            
        const itemClass = type === 'task' ? 'attachment-item' : 'media-item';
        const removeClass = type === 'task' ? 'attachment-remove' : 'media-remove';
        
        // Clear previous previews
        container.innerHTML = '';
        
        const itemElement = document.createElement('div');
        itemElement.className = itemClass;
        
        if (attachment.type === 'image') {
            const img = document.createElement('img');
            img.src = attachment.url;
            img.alt = attachment.name || 'Attachment';
            itemElement.appendChild(img);
        } else if (attachment.type === 'video') {
            const video = document.createElement('video');
            video.src = attachment.url;
            video.controls = true;
            itemElement.appendChild(video);
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = removeClass;
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (type === 'task') {
                this.currentAttachment = null;
            } else {
                this.currentNoteMedia = null;
            }
            container.innerHTML = '';
        });
        
        itemElement.appendChild(removeButton);
        container.appendChild(itemElement);
    }

    // ===== NOTES MANAGEMENT =====
    async loadNotes() {
        try {
            if (!this.currentUser) return;
            
            const doc = await db.collection('notes').doc(this.currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                this.notes = data.content || '';
                document.getElementById('notepad-content').value = this.notes;
                
                // Load note attachments
                if (data.attachments && data.attachments.length > 0) {
                    this.renderNoteAttachments(data.attachments);
                }
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showToast('Failed to load notes', 'error');
        }
    }
    
    renderNoteAttachments(attachments) {
        const container = document.getElementById('note-attachments');
        container.innerHTML = '';
        
        if (!attachments || attachments.length === 0) return;
        
        attachments.forEach((attachment) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'note-attachment';
            
            if (attachment.type === 'image') {
                const img = document.createElement('img');
                img.src = attachment.url;
                img.alt = attachment.name || 'Note attachment';
                itemElement.appendChild(img);
            } else if (attachment.type === 'video') {
                const video = document.createElement('video');
                video.src = attachment.url;
                video.controls = true;
                itemElement.appendChild(video);
            }
            
            const removeButton = document.createElement('button');
            removeButton.className = 'note-attachment-remove';
            removeButton.innerHTML = '<i class="fas fa-times"></i>';
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeNoteAttachment(attachment.publicId);
            });
            
            itemElement.appendChild(removeButton);
            container.appendChild(itemElement);
        });
    }
    
    async removeNoteAttachment(publicId) {
        try {
            if (!this.currentUser) return;
            
            this.setSyncStatus('syncing');
            
            const noteDoc = await db.collection('notes').doc(this.currentUser.uid).get();
            if (!noteDoc.exists) return;
            
            const data = noteDoc.data();
            const attachments = data.attachments || [];
            const updatedAttachments = attachments.filter(a => a.publicId !== publicId);
            
            await db.collection('notes').doc(this.currentUser.uid).update({
                attachments: updatedAttachments,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.renderNoteAttachments(updatedAttachments);
            this.showToast('Attachment removed', 'success');
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error removing attachment:', error);
            this.showToast('Failed to remove attachment', 'error');
            this.setSyncStatus('error');
        }
    }

    autoSaveNotes() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveNotes();
        }, 2000);
    }
    
    async saveNotes() {
        try {
            if (!this.currentUser) {
                this.showToast('You must be logged in to save notes', 'error');
                return;
            }
            
            this.setSyncStatus('syncing');
            
            await db.collection('notes').doc(this.currentUser.uid).set({
                content: this.notes,
                userId: this.currentUser.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            const saveIndicator = document.getElementById('save-indicator');
            saveIndicator.classList.add('show');
            setTimeout(() => {
                saveIndicator.classList.remove('show');
            }, 2000);
            
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showToast('Failed to save notes', 'error');
            this.setSyncStatus('error');
        }
    }
    
    openMediaModal() {
        document.getElementById('media-modal').classList.add('show');
        this.currentNoteMedia = null;
        document.getElementById('media-preview').innerHTML = '';
    }

    closeMediaModal() {
        document.getElementById('media-modal').classList.remove('show');
        this.currentNoteMedia = null;
    }

    async saveNoteMedia() {
        if (!this.currentNoteMedia) {
            this.showToast('Please upload a file first', 'error');
            return;
        }
        
        try {
            if (!this.currentUser) {
                this.showToast('You must be logged in to save media', 'error');
                return;
            }
            
            this.setSyncStatus('syncing');
            
            // Get existing note data
            const noteDoc = await db.collection('notes').doc(this.currentUser.uid).get();
            const data = noteDoc.exists ? noteDoc.data() : {};
            const attachments = data.attachments || [];
            
            // Add new media to attachments
            attachments.push(this.currentNoteMedia);
            
            // Update document
            await db.collection('notes').doc(this.currentUser.uid).set({
                attachments,
                userId: this.currentUser.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            // Update UI
            this.renderNoteAttachments(attachments);
            this.closeMediaModal();
            this.showToast('Media attached successfully!', 'success');
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error attaching media:', error);
            this.showToast('Failed to attach media', 'error');
            this.setSyncStatus('error');
        }
    }
    
    renderTasks() {
        const container = document.getElementById('tasks-list');
        const emptyState = document.getElementById('tasks-empty-state');
        
        // Clear container
        container.innerHTML = '';
        
        // Filter tasks
        let filteredTasks = [...this.tasks];
        
        if (this.currentFilter === 'pending') {
            filteredTasks = filteredTasks.filter(task => !task.completed);
        } else if (this.currentFilter === 'completed') {
            filteredTasks = filteredTasks.filter(task => task.completed);
        } else if (this.currentFilter === 'priority') {
            filteredTasks = filteredTasks.filter(task => !task.completed)
                .sort((a, b) => {
                    const priorityMap = { high: 0, medium: 1, low: 2 };
                    return priorityMap[a.priority] - priorityMap[b.priority];
                });
        }
        
        // Apply search filter
        if (this.searchQuery) {
            filteredTasks = filteredTasks.filter(task => 
                task.title.toLowerCase().includes(this.searchQuery) || 
                (task.description && task.description.toLowerCase().includes(this.searchQuery))
            );
        }
        
        // Show empty state if no tasks
        if (filteredTasks.length === 0) {
            container.appendChild(emptyState);
            return;
        }
        
        // Hide empty state
        emptyState.remove();
        
        // Render tasks
        filteredTasks.forEach(task => {
            const taskCard = this.createTaskCard(task);
            container.appendChild(taskCard);
        });
    }
    
    createTaskCard(task) {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskCard.dataset.id = task.id;
        
        const deadline = new Date(task.deadline);
        const isOverdue = !task.completed && deadline < new Date();
        
        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     data-id="${task.id}" onclick="appManager.toggleTaskComplete('${task.id}')"></div>
                <div class="task-content">
                    <h3 class="task-title">${task.title}</h3>
                    ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                </div>
            </div>
            
            <div class="task-meta">
                <div class="task-deadline">
                    <i class="far fa-clock"></i>
                    <span style="${isOverdue ? 'color: var(--danger-color);' : ''}">${deadline.toLocaleString()}</span>
                </div>
                <div class="task-priority ${task.priority}">${task.priority}</div>
            </div>
            
            ${task.attachment ? this.createAttachmentPreview(task.attachment) : ''}
            
            <div class="task-actions">
                <button class="task-action-btn" onclick="appManager.openTaskModal(${JSON.stringify(task)})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="task-action-btn delete" onclick="appManager.deleteTask('${task.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return taskCard;
    }
    
    createAttachmentPreview(attachment) {
        if (!attachment) return '';
        
        if (attachment.type === 'image') {
            return `
                <div class="task-attachment-preview">
                    <img src="${attachment.url}" alt="Attachment">
                </div>
            `;
        } else if (attachment.type === 'video') {
            return `
                <div class="task-attachment-preview">
                    <video src="${attachment.url}" controls></video>
                </div>
            `;
        }
        
        return '';
    }
    
    setSyncStatus(status) {
        const syncStatus = document.getElementById('sync-status');
        const syncIcon = syncStatus.previousElementSibling;
        
        switch(status) {
            case 'syncing':
                syncStatus.textContent = 'Syncing...';
                syncIcon.className = 'fas fa-sync-alt syncing';
                break;
            case 'synced':
                syncStatus.textContent = 'Synced';
                syncIcon.className = 'fas fa-cloud-upload-alt';
                break;
            case 'error':
                syncStatus.textContent = 'Sync failed';
                syncIcon.className = 'fas fa-exclamation-circle';
                break;
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-content i');
        
        // Clear any existing timeout
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
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
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the application
const appManager = new TaskManager();

// Make it accessible globally for onclick handlers
window.appManager = appManager;