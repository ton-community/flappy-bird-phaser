import { ConnectTelegramWalletButton, ConnectTelegramWalletParams } from "./phaser-ton";
import { loadIcons } from "./phaser-ton/icons";

export class ConnectWalletCanvasScene extends Phaser.Scene {
    public static sceneKey = 'ConnectWalletCanvasScene';
    button!: ConnectTelegramWalletButton;

    constructor(private params: ConnectTelegramWalletParams) {
        super({ key: ConnectWalletCanvasScene.sceneKey, active: false });
    }

    create() {
        // todo load icons in ConnectTelegramWalletButton
        loadIcons(this.textures).then(() =>{
            this.button = new ConnectTelegramWalletButton(
                this,
                0,
                0,
                this.params
            );
        });
    }
}