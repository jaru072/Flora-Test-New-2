// Global safety patch for JSON.stringify to prevent Uncaught TypeError: Converting circular structure to JSON
(function() {
  const originalStringify = JSON.stringify;
  window.safeJsonStringify = function(value, replacer, space) {
    const seen = new WeakSet();
    const safeReplacer = function(key, val) {
      let currentVal = val;
      if (typeof replacer === 'function') {
        currentVal = replacer.call(this, key, val);
      } else if (Array.isArray(replacer) && key !== '') {
        if (!replacer.includes(key)) return undefined;
      }
      
      if (typeof currentVal === 'object' && currentVal !== null) {
        if (typeof Node !== 'undefined' && currentVal instanceof Node) return undefined;
        if (typeof Window !== 'undefined' && currentVal instanceof Window) return undefined;
        if (typeof Event !== 'undefined' && currentVal instanceof Event) return undefined;
        if (seen.has(currentVal)) {
          return undefined;
        }
        seen.add(currentVal);
      }
      if (typeof currentVal === 'function') {
        return undefined;
      }
      return currentVal;
    };

    try {
      return originalStringify(value, replacer, space);
    } catch (err) {
      console.warn("JSON.stringify caught circular reference error, applying safe serialization fallback:", err);
      try {
        return originalStringify(value, safeReplacer, space);
      } catch (err2) {
        console.error("JSON.stringify safe fallback failed:", err2);
        return "{}";
      }
    }
  };

  JSON.stringify = function(value, replacer, space) {
    return window.safeJsonStringify(value, replacer, space);
  };

  window.handleGoogleSignInAndClose = function() {
    if (typeof window.handleGoogleSignIn === 'function') {
      return window.handleGoogleSignIn();
    }
  };
})();
