// components/SelfConnect.tsx
'use client'

import { useEffect } from 'react'

export default function SelfConnect() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://self.xyz/self-connect.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div>
      <div
        className="self-connect"
        data-client-id="YOUR_CLIENT_ID"
        data-success-callback="onSelfConnect"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            function onSelfConnect(response) {
              console.log("Self.xyz login success:", response);
              localStorage.setItem("self_jwt", response.jwt);
            }
          `,
        }}
      />
    </div>
  )
}
