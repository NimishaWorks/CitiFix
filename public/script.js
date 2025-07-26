document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('report-form');
    const statusMsg = document.getElementById('statusMsg');
    const imageInput = document.getElementById('images');
    const imagePreview = document.getElementById('imagePreview');
    const getLocationBtn = document.getElementById('getLocation');
    const submitBtn = reportForm?.querySelector('button[type="submit"]');

    // Image preview functionality with validation
    imageInput?.addEventListener('change', function(e) {
        imagePreview.innerHTML = '';
        const file = e.target.files[0];
        
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showStatus('Image size should be less than 5MB', 'error');
                imageInput.value = '';
                return;
            }

            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                showStatus('Please upload a valid image file (JPEG, PNG, or GIF)', 'error');
                imageInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                imagePreview.appendChild(img);
            }
            reader.readAsDataURL(file);
        }
    });

    // Get current location with timeout
    getLocationBtn?.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            getLocationBtn.disabled = true;
            getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';

            // Set timeout for geolocation request
            const timeoutId = setTimeout(() => {
                getLocationBtn.disabled = false;
                getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Get Current Location';
                showStatus('Location request timed out. Please try again.', 'error');
            }, 10000);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    document.getElementById('latitude').value = position.coords.latitude.toFixed(6);
                    document.getElementById('longitude').value = position.coords.longitude.toFixed(6);
                    getLocationBtn.innerHTML = '<i class="fas fa-check"></i> Location Found';
                    setTimeout(() => {
                        getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Get Current Location';
                        getLocationBtn.disabled = false;
                    }, 2000);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    console.error(error);
                    getLocationBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Location Error';
                    getLocationBtn.disabled = false;
                    const errorMessages = {
                        1: 'Permission denied. Please enable location access.',
                        2: 'Location unavailable. Please try again.',
                        3: 'Request timed out. Please try again.'
                    };
                    showStatus(errorMessages[error.code] || 'Could not get location', 'error');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            showStatus('Geolocation is not supported by your browser', 'error');
        }
    });

    // Form submission with loading state
    reportForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }
        
        const formData = new FormData(reportForm);
        
        try {
            const response = await fetch('/api/report', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                showStatus('Issue reported successfully!', 'success');
                reportForm.reset();
                imagePreview.innerHTML = '';
                
                // Redirect to issues page after successful submission
                setTimeout(() => {
                    window.location.href = '/issues.html';
                }, 2000);
            } else {
                throw new Error(data.error || 'Error submitting report');
            }
        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
            }
        }
    });

    // Enhanced status message display
    function showStatus(message, type = 'info') {
        if (!statusMsg) return;
        
        statusMsg.textContent = message;
        statusMsg.className = `status-message ${type}`;
        statusMsg.style.opacity = '1';
        
        // Remove any existing timeout
        if (statusMsg.timeoutId) {
            clearTimeout(statusMsg.timeoutId);
        }

        // Set new timeout
        statusMsg.timeoutId = setTimeout(() => {
            statusMsg.style.opacity = '0';
            setTimeout(() => {
                statusMsg.textContent = '';
            }, 300);
        }, 5000);
    }

    // Add smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});