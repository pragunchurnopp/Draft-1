(function () {
    const sdkTracker = {
      init: function (clientId) {
        this.clientId = clientId;
        this.sessionId = localStorage.getItem('sdkUserId') || this.generateSessionId();
        localStorage.setItem('sdkUserId', this.sessionId);
        this.startTime = Date.now();
        this.active = true;
        this.lastInteractionTime = this.startTime;
        this.rageClickTimeout = 1000; // 1 second
        this.rageClickThreshold = 3; // 3 clicks
        this.clicks = [];
        this.scrollDepth = 0;
        this.deviceInfo = this.getDeviceInfo();
        this.setupEventListeners();
        this.trackSessionDuration();
        this.checkUserInactivity();
      },
  
      generateSessionId: function () {
        return 'session-' + Math.random().toString(36).substr(2, 9);
      },
  
      setupEventListeners: function () {
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('scroll', this.handleScroll.bind(this));
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        document.addEventListener('mouseout', this.handleMouseOut.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
      },
  
      handleClick: function (event) {
        const target = event.target;
        const tag = target.tagName;
        const id = target.id;
        const classes = target.className;
  
        this.trackInteraction({ tag, id, classes });
  
        // Rage Click Detection
        const now = Date.now();
        this.clicks.push(now);
        this.clicks = this.clicks.filter((timestamp) => now - timestamp < this.rageClickTimeout);
  
        if (this.clicks.length >= this.rageClickThreshold) {
          this.trackRageClick({ tag, id, classes });
          this.clicks = []; // Reset clicks after detecting rage click
        }
  
        // Cart Abandonment & Checkout Progress
        if (classes.includes('add-to-cart')) {
          this.trackCartAbandonment();
        } else if (classes.includes('checkout-step')) {
          this.trackCheckoutProgress(id);
        }
  
        // Help Center Visit
        if (classes.includes('help-center-link')) {
          this.trackHelpCenterVisit();
        }
  
        this.lastInteractionTime = now;
        this.active = true;
      },
  
      handleScroll: function () {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
        if (docHeight <= 0) return; // prevent divide by zero
      
        const scrollPercent = Math.round((scrollTop / docHeight) * 100);
      
        if (scrollPercent > this.scrollDepth) {
          this.scrollDepth = scrollPercent;
          this.trackScrollDepth(this.scrollDepth);
          console.log("Scroll depth updated:", this.scrollDepth); // Add debug log
        }
      
        this.lastInteractionTime = Date.now();
        this.active = true;
      },
      
  
      handleVisibilityChange: function () {
        if (document.visibilityState === 'hidden') {
          this.active = false;
          this.trackUserInactive();
        } else {
          this.active = true;
          this.trackUserActive();
        }
      },
  
      handleMouseOut: function (event) {
        if (event.clientY < 0) {
          this.trackExitIntent();
        }
      },
  
      handleBeforeUnload: function () {
        this.trackSessionDuration();
      },
  
      trackInteraction: function (details) {
        this.sendEvent('interaction', details);
      },
  
      trackRageClick: function (details) {
        this.sendEvent('rageClick', details);
      },
  
      trackCartAbandonment: function () {
        this.sendEvent('cartAbandonment', { message: 'User added item to cart' });
      },
  
      trackCheckoutProgress: function (step) {
        this.sendEvent('checkoutProgress', { step });
      },
  
      trackUserActive: function () {
        this.sendEvent('userActive', { message: 'User is active' });
      },
  
      trackUserInactive: function () {
        this.sendEvent('userInactive', { message: 'User is inactive' });
      },
  
      trackSessionDuration: function () {
        const duration = Date.now() - this.startTime;
        this.sendEvent('sessionDuration', { duration });
      },
  
      trackScrollDepth: function (depth) {
        this.sendEvent('scrollDepth', { depth });
      },
  
      trackHelpCenterVisit: function () {
        this.sendEvent('helpCenterVisit', { message: 'User visited help center' });
      },
  
      trackExitIntent: function () {
        this.sendEvent('exitIntent', { message: 'User showed exit intent' });
      },
  
      getDeviceInfo: function () {
        const ua = navigator.userAgent;
        let device = 'Desktop';
  
        if (/Mobi|Android/i.test(ua)) {
          device = 'Mobile';
        } else if (/iPad|Tablet/i.test(ua)) {
          device = 'Tablet';
        }
  
        return {
          device,
          userAgent: ua,
          platform: navigator.platform,
          language: navigator.language,
        };
      },
  
      checkUserInactivity: function () {
        setInterval(() => {
          const now = Date.now();
          if (this.active && now - this.lastInteractionTime > 30000) { // 30 seconds of inactivity
            this.active = false;
            this.trackUserInactive();
          }
        }, 5000);
      },
  
      sendEvent: function (eventType, data) {
        const payload = {
            clientID: this.clientId,
            userID: this.sessionId,
            event: eventType,
            data: {
              ...data,
              deviceInfo: this.deviceInfo,
            },
          };
          
      
        console.log("Sending event:", eventType, payload);
      
        fetch('http://localhost:5000/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((res) => res.json())
          .then((res) => console.log("Event sent:", res))
          .catch((err) => console.error("Failed to send event:", err));
      }
      
    }; 
  
    window.sdkTracker = sdkTracker; 
  })();
   