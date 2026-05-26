// OpenLDR Keycloak Theme JavaScript

(function() {
  'use strict';

  // Squares Background Animation (inspired by React component)
  function initSquaresBackground() {
    const container = document.getElementById('kc-squares-container');
    if (!container) return;

    const squareSize = 40;
    const borderColor = '#e5e7eb';
    const hoverFillColor = '#f3f4f6';
    
    const cols = Math.ceil(container.offsetWidth / squareSize);
    const rows = Math.ceil(container.offsetHeight / squareSize);
    
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    
    // Create squares
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', j * squareSize);
        rect.setAttribute('y', i * squareSize);
        rect.setAttribute('width', squareSize);
        rect.setAttribute('height', squareSize);
        rect.setAttribute('fill', 'transparent');
        rect.setAttribute('stroke', borderColor);
        rect.setAttribute('stroke-width', '1');
        rect.style.transition = 'fill 0.3s ease';
        
        // Add hover effect
        rect.addEventListener('mouseenter', function() {
          this.setAttribute('fill', hoverFillColor);
        });
        
        rect.addEventListener('mouseleave', function() {
          this.setAttribute('fill', 'transparent');
        });
        
        // Random animation delay for some squares
        if (Math.random() > 0.95) {
          setTimeout(() => {
            rect.setAttribute('fill', hoverFillColor);
            setTimeout(() => {
              rect.setAttribute('fill', 'transparent');
            }, 2000);
          }, Math.random() * 5000);
        }
        
        svg.appendChild(rect);
      }
    }
    
    container.appendChild(svg);
    
    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        container.innerHTML = '';
        initSquaresBackground();
      }, 250);
    });
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize squares background
    initSquaresBackground();
    
    // Animate card on load
    const card = document.querySelector('.card-pf');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(function() {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100);
    }

    // Add password visibility toggle
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(function(input) {
      const formGroup = input.closest('.form-group');
      if (!formGroup) return;
      
      // Create wrapper for input if it doesn't have one
      let inputWrapper = input.parentElement;
      if (inputWrapper.classList.contains('form-group')) {
        // Input is direct child of form-group, wrap it
        inputWrapper = document.createElement('div');
        inputWrapper.style.position = 'relative';
        input.parentNode.insertBefore(inputWrapper, input);
        inputWrapper.appendChild(input);
      } else if (inputWrapper.style.position !== 'relative') {
        inputWrapper.style.position = 'relative';
      }
      
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.innerHTML = '👁️';
      toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
      toggleBtn.style.cssText = `
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.1rem;
        opacity: 0.5;
        transition: opacity 0.2s;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        z-index: 10;
      `;
      
      toggleBtn.addEventListener('mouseenter', function() {
        this.style.opacity = '1';
      });
      
      toggleBtn.addEventListener('mouseleave', function() {
        this.style.opacity = '0.5';
      });
      
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (input.type === 'password') {
          input.type = 'text';
          this.innerHTML = '🙈';
          this.setAttribute('aria-label', 'Hide password');
        } else {
          input.type = 'password';
          this.innerHTML = '👁️';
          this.setAttribute('aria-label', 'Show password');
        }
      });
      
      // I dont need this, using default button from keycloak
      // inputWrapper.appendChild(toggleBtn);
      
      // Add padding to input to prevent text from going under the button
      const currentPadding = window.getComputedStyle(input).paddingRight;
      input.style.paddingRight = '40px';
    });

    // Add loading state to submit buttons
    const forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
      form.addEventListener('submit', function() {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.disabled = true;
          const originalText = submitBtn.textContent || submitBtn.value;
          const loadingHTML = '<span class="kc-loading"></span> ' + originalText;
          
          if (submitBtn.tagName === 'BUTTON') {
            submitBtn.innerHTML = loadingHTML;
          } else {
            submitBtn.value = 'Loading...';
          }
        }
      });
    });

    // Auto-focus first input field
    const firstInput = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
    if (firstInput && !firstInput.value) {
      firstInput.focus();
    }

    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    buttons.forEach(function(button) {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          left: ${x}px;
          top: ${y}px;
          pointer-events: none;
          transform: scale(0);
          animation: ripple-animation 0.6s ease-out;
        `;
        
        if (this.style.position !== 'relative' && this.style.position !== 'absolute') {
          this.style.position = 'relative';
        }
        if (this.style.overflow !== 'hidden') {
          this.style.overflow = 'hidden';
        }
        
        this.appendChild(ripple);
        
        setTimeout(function() {
          ripple.remove();
        }, 600);
      });
    });

    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple-animation {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    // Locale dropdown toggle
    const localeLink = document.getElementById('kc-current-locale-link');
    if (localeLink) {
      localeLink.addEventListener('click', function(e) {
        e.preventDefault();
        const dropdown = this.nextElementSibling;
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
      });
      
      // Initially hide dropdown
      const dropdown = localeLink.nextElementSibling;
      if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.bottom = '100%';
        dropdown.style.left = '50%';
        dropdown.style.transform = 'translateX(-50%)';
        dropdown.style.marginBottom = '8px';
        dropdown.style.minWidth = '150px';
      }
    }

    // Add keyboard navigation hints
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', function() {
      document.body.classList.remove('keyboard-navigation');
    });

    // Enhanced focus styles for keyboard navigation
    const focusStyle = document.createElement('style');
    focusStyle.textContent = `
      body.keyboard-navigation *:focus {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(focusStyle);
  });
})();