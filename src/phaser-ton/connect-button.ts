import TonConnect, { Wallet, WalletConnectionSource } from "@tonconnect/sdk";
import { Locale, Locales, Styles } from "./protocol";
import { DropdownMenu, DropdownMenuItem } from "./dropdown";
import { buttonDesign, locales } from "./consts"
import { hexToNumber, rawAddressToFriendly } from "./utils";
import { getConnector } from "./connect";
import { redirectToTelegram } from "./tma-web-api";

export let connectedWallet: Wallet | null = null;

export interface ConnectTelegramWalletParams {
    style: Styles;
    onWalletChange: (wallet: Wallet | null) => void;
    onError: (error: Error | unknown) => void;
    language?: Locales;
    appManifestUrl?: string;
}

export class ConnectTelegramWalletButton extends Phaser.GameObjects.Container {
    buttonContainer: Phaser.GameObjects.Rectangle
    wallet: Wallet | null = null;
    params: ConnectTelegramWalletParams;
    connectionSource: WalletConnectionSource;
    connector: TonConnect;
    unsubscribeFromConnector: () => void;
    dropdownMenu: DropdownMenu;
    locale: Locale;

    constructor(
        scene: Phaser.Scene,
        x: number = 0,
        y: number = 0,
        params: ConnectTelegramWalletParams
    ) {
        super(scene, x, y);
        this.params = params;
        this.connectionSource = {
            bridgeUrl: 'https://bridge.tonapi.io/bridge',
            universalLink: 'https://t.me/wallet?attach=wallet'
        }
        this.connector = getConnector(
            params.appManifestUrl ? { manifestUrl: params.appManifestUrl } : undefined
        );

        const locale = locales[params.language ?? 'en'];
        this.locale = locale;
        const textColor = params.style === 'dark'
            ? buttonDesign.whiteColor : buttonDesign.blackColor;
        const backgroundColor = params.style === 'dark'
            ? hexToNumber(buttonDesign.blackColor) : hexToNumber(buttonDesign.whiteColor);

        const textObject = scene.add.text(
            buttonDesign.horizontalPadding,
            buttonDesign.verticalPadding,
            locale.connectWallet,
            {
                color: textColor,
                fontFamily: buttonDesign.fontFamily,
                fontSize: buttonDesign.fontSize,
            }
        );

        const textWidth = textObject.width;
        const textHeight = textObject.height;
        const buttonWidth = textWidth + (buttonDesign.horizontalPadding * 2);
        const buttonHeight = textHeight + (buttonDesign.verticalPadding * 2);

        const button = scene.add.rectangle(
            0,
            0,
            buttonWidth,
            buttonHeight,
            backgroundColor
        );
        button.setOrigin(0, 0);
        this.buttonContainer = button;

        this.dropdownMenu = new DropdownMenu(
            scene,
            0,
            buttonHeight + buttonDesign.dropDown.topMargin,
            {
                backgroundColor,
                textColor,
                items: [
                    {
                        text: locale.copyAddress,
                        onClick: this.copyAddress,
                    },
                    {
                        text: locale.disconnectWallet,
                        onClick: () => {
                            this.toggleDropdownMenu();
                            this.disconnectWallet();
                        }
                    },
                ]
            }
        );
        this.dropdownMenu.setVisible(false);

        this.add([button, textObject, this.dropdownMenu]);
        scene.add.existing(this);

        this.unsubscribeFromConnector = this.connector.onStatusChange((wallet) => {
            console.log('Wallet status changed!!!!', wallet);
            connectedWallet = wallet;
            this.wallet = wallet;
            this.enable();
            button.removeAllListeners('pointerdown');

            if (wallet) {
                textObject.setText(rawAddressToFriendly(wallet.account.address, true));
                button.on('pointerdown', this.toggleDropdownMenu);
            } else {
                textObject.setText('Connect Wallet');
                button.on('pointerdown', this.connectWallet);
            }
        });

        this.connector.restoreConnection().then(() => {
            if (this.wallet === null) {
                this.enable();
                button.removeAllListeners('pointerdown');
                button.on('pointerdown', this.connectWallet);
            }
        });
    }

    private connectWallet = () => {
        try {
            this.disable();
            const connectUrl = this.connector.connect(this.connectionSource);
            if (connectUrl) {
                redirectToTelegram(connectUrl, {
                    returnStrategy: 'back',
                    twaReturnUrl: 'https://t.me/flappybirddevbot/flappybirddev',
                    forceRedirect: false
                });
            }
        } catch (error) {
            this.params.onError(error);
        } finally {
            this.enable();
        }
    }

    private disconnectWallet = async () => {
        try {
            this.disable();
            await this.connector.disconnect();
        } catch (error) {
            this.params.onError(error);
        } finally {
            this.enable();
        }
    }

    private copyAddress = async (item: DropdownMenuItem) => {
        if (this.wallet == null) {
            return;
        }

        try {
            await navigator.clipboard.writeText(rawAddressToFriendly(this.wallet.account.address));
            const oldText = item.text.text;
            item.text.setText(this.locale.addressCopied);
            setTimeout(() => {
                try {
                    item.text.setText(oldText);
                    this.toggleDropdownMenu();
                } catch(error) {
                    // ignore in case the object was destroyed by leaving the scene
                }
            }, 500);
        } catch (error) {
            this.params.onError(error);
        }
    }

    private disable() {
        this.buttonContainer.setInteractive(false);
    }

    private enable() {
        this.buttonContainer.setInteractive({ useHandCursor: true});
    }

    private toggleDropdownMenu = () => {
        this.dropdownMenu.setVisible(!this.dropdownMenu.visible);
    }

    public destroy() {
        this.unsubscribeFromConnector();
        // todo Will the super destroy() call remove all listeners?
        /* this.buttonContainer.removeAllListeners();
        this.buttonContainer.destroy(); */
        super.destroy();
    }
}
