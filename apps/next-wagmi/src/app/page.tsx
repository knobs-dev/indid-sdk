'use client'
import { Account } from '../components/Account'
import { Balance } from '../components/Balance'
import { Connect } from '../components/Connect'
import { Connected } from '../components/Connected'
import { NetworkSwitcher } from '../components/NetworkSwitcher'
import { Send } from '../components/Send'
import { TestSDK } from '../components/TestSDK'


export default function Page() {
  return (
    <div>
      <Connect />
      <Connected>
        <hr />
        <h2>Network</h2>
        <NetworkSwitcher />
        <br />
        <hr />
        <h2>Account</h2>
        <Account />
        <br />
        <hr />
        <h2>Balance</h2>
        <Balance />
        <br />
        <hr />
        <h2>Send</h2>
        <Send />
        <br />
        <hr />
        <h2>TestSDK</h2>
        <TestSDK />
        <br />
        <hr />
      </Connected>
    </div>
  )
}
