# phaser-ton

TON bindings and utilities for Phaser.io

## Usage

1. Import canvas implementation of `Connect Wallet` button:
```typescript
import { ConnectTelegramWalletButton } from './phaser-ton';
```
2. Create your canvas UI scene and add the connect button:
```typescript
export class UiScene extends Phaser.Scene {
    create() {
        // your UI elements here

        this.button = new ConnectTelegramWalletButton(
            this,
            // x position of the button
            16,
            // y position of the button
            40,
            // button options
            {
                style: 'light',
                appManifestUrl: 'your app manifest url here',
            }
        );
    }
}
```
3. After user connected his wallet you can use it across your app by importing `connectedWallet` object:
```typescript
import { connectedWallet } from './phaser-ton';
```
Read [Wallet interface documentation](https://ton-connect.github.io/sdk/interfaces/_tonconnect_sdk.Wallet.html) to learn available props and methods.

## ConnectTelegramWalletButton options

| Option | Description | Default |
| -------- | -------- | -------- |
| appManifestUrl | URL of your app manifest. Read about the [parameters of the manifest](https://docs.ton.org/develop/dapps/ton-connect/protocol/requests-responses#app-manifest) in related docs. | Looks for `tonconnect-manifest.json` file public root of your app, like `https:example.com/tonconnect-manifest.json` |
| lang | Language of the button. Languages `en` and `ru` supported so far | `en` |
| style | Button style. Can be `light` or `dark` | `light` |
| onWalletChange | Callback function that will be called when user connects or disconnects his wallet | `undefined` |
| onError | Callback function that will be called when error occurs | `undefined` |
