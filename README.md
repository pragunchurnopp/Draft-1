# ChurnOpp JavaScript SDK

The ChurnOpp SDK helps you monitor user behavior, detect churn signals, and trigger smart retention strategies from any website or web app — all with a lightweight, zero-friction drop-in script.

---

## 🚀 Installation

Add the SDK script to your HTML:

```html
<script src="/path-to-sdk/churnopp-sdk.js"></script>
```

> In production, this will be hosted on a CDN or bundled via npm.

---

## 🛠️ Initialization

```js
sdkTracker.init("your-client-id", true);
```

- `"your-client-id"` — Unique client ID provided when you register on ChurnOpp
- `true` — (Optional) Enable debug logs

---

## 🎯 What Does It Track?

Out of the box, the SDK tracks the following:

| Event              | Trigger Example                            |
| ------------------ | ------------------------------------------ |
| `interaction`      | Clicks on buttons, links, elements         |
| `rageClick`        | Multiple rapid clicks (frustration signal) |
| `scrollDepth`      | Maximum scroll depth on page               |
| `cartAbandonment`  | Clicks with class `.add-to-cart`           |
| `checkoutProgress` | Checkout flow step clicks                  |
| `helpCenterVisit`  | Help center link clicked                   |
| `sessionDuration`  | Time user stayed on site                   |
| `userActive`       | User comes back or interacts               |
| `userInactive`     | User inactive for 30 seconds               |
| `exitIntent`       | Mouse movement toward tab close            |

---

## 🔐 Authentication

You only need a valid `clientID` to use the SDK.  
All events are sent to your backend’s `/api/events` endpoint.

---

## 🧪 Debug Mode

Pass `true` as the second argument to `init()` to see logs:

```js
sdkTracker.init("your-client-id", true);
```

---

## 🛡️ Reliability

- Built-in retry mechanism for failed API calls
- Silent fail-safe — won't break the website
- No external dependencies

---

## 📡 Backend Requirements

The SDK expects your backend to expose:

```
POST /api/events
Content-Type: application/json
```

Payload structure:

```json
{
  "clientID": "your-client-id",
  "userID": "session-abc123",
  "event": "interaction",
  "data": {
    "tag": "BUTTON",
    "id": "submit-btn",
    "classes": "cta-button",
    "deviceInfo": {
      "device": "Desktop",
      "userAgent": "...",
      ...
    }
  }
}
```

---

## 🤝 Contributing

We welcome contributions from devs, testers, or companies using the SDK in unique ways.

---

Need help? Email support@churnopp.com
