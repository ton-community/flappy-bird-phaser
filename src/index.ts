import * as Phaser from 'phaser';
import { TonConnectUI, Wallet } from '@tonconnect/ui';
import { restoreWalletConnection } from './phaser-ton';
import { APP_MANIFEST_URL, ENDPOINT } from './consts';
import { UI } from './ui';
import { ConnectWalletHtmlScene } from './connect-wallet-html';
import { ConnectWalletCanvasScene } from './connect-wallet-canvas';

const GAME_HEIGHT = window.innerHeight;
const GAME_WIDTH = window.innerWidth;
const GAP_START = GAME_HEIGHT / 6;
const GAP_MIN = 125;
const GAP_MAX = 175;
const GAP_END = 600 - GAP_START - GAP_MAX;
const GRAVITY = 750;
const JUMP_VEL = 300;
const JUMP_COOLDOWN = 20;
const COLUMN_ACCEL = 0.001;
const COLUMN_TIME_ACCEL = 0.01;
const PIPE_SCALE = 1.5;
const PIPE_WIDTH = 52 * PIPE_SCALE;
const PIPE_HEIGHT = 320 * PIPE_SCALE;
const FLAP_THRESH = 50;
const BG_HEIGHT = 512;
const INITIAL_COLUMN_VELOCITY = -150;
const INITIAL_COLUMN_INTERVAL = 3000;

let CONNECT_UI: 'html' | 'canvas' = 'canvas';

const achievements: { [k: string]: string } = {
    'first-time': 'Played 1 time',
    'five-times': 'Played 5 times',
};

async function submitPlayed(score: number) {
    return await (await fetch(ENDPOINT + '/played', {
        body: JSON.stringify({
            tg_data: (window as any).Telegram.WebApp.initData,
            wallet: tc.account?.address,
            score,
        }),
        headers: {
            'content-type': 'application/json',
        },
        method: 'POST',
    })).json();
}

class MyScene extends Phaser.Scene {
    character!: Phaser.GameObjects.Image;
    columnGroup!: Phaser.Physics.Arcade.Group;
    lastJump: number = 0;
    columnVelocity = INITIAL_COLUMN_VELOCITY;
    tracked: { r1: Phaser.GameObjects.Image, r2: Phaser.GameObjects.Image, scored: boolean }[] = [];
    score: number = 0;
    columnInterval = INITIAL_COLUMN_INTERVAL;
    lastColumn = 0;
    background!: Phaser.GameObjects.TileSprite;
    firstLaunch: boolean = true;

    constructor(private ui: UI) {
        super();

        ui.onPlayClicked(() => {
            ui.hideShop();
            ui.hideMain();

            this.scene.restart();
        });
    }

    getRealGameWidth() {
        return GAME_WIDTH * (this.game.canvas.parentElement!.clientWidth / this.game.canvas.clientWidth);
    }

    preload() {
        this.load.image('pipe-green', 'assets/pipe-green.png');
        this.load.image('pipe-red', 'assets/pipe-red.png');
        this.load.image('bird-up', 'assets/bluebird-upflap.png');
        this.load.image('bird-down', 'assets/bluebird-downflap.png');
        this.load.image('bird-mid', 'assets/bluebird-midflap.png');
        this.load.image('bg', 'assets/background-day.png');
    }

    create() {
        const realWidth = this.getRealGameWidth();
        this.background = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg');
        this.background.tileScaleX = this.background.tileScaleY = GAME_HEIGHT / BG_HEIGHT;
        this.character = this.add.image(realWidth / 8, GAME_HEIGHT / 2, 'bird-mid');
        this.physics.add.existing(this.character);
        this.columnGroup = this.physics.add.group();
        this.physics.add.overlap(this.character, this.columnGroup, () => {
            this.onOverlapped();
        });
        const charBody = this.character.body as Phaser.Physics.Arcade.Body;
        charBody.setCollideWorldBounds(true, undefined, undefined, true);
        charBody.world.on('worldbounds', () => {
            this.onOverlapped();
        });
        charBody.setAccelerationY(GRAVITY);
        charBody.setVelocityY(-JUMP_VEL);
        this.input.on('pointerdown', () => this.onInput());
        this.input.keyboard?.on('keydown', () => this.onInput());

        if (this.firstLaunch) {
            this.firstLaunch = false;
            this.scene.pause();
        }

        this.lastJump = Date.now();
        this.columnVelocity = INITIAL_COLUMN_VELOCITY;
        this.columnInterval = INITIAL_COLUMN_INTERVAL;
        this.tracked = [];
        this.score = 0;
        this.ui.setScore(this.score);
        this.lastColumn = 0;
    }

    onInput() {
        const time = Date.now();
        if (time > this.lastJump + JUMP_COOLDOWN) {
            this.lastJump = time;
            (this.character.body as Phaser.Physics.Arcade.Body).setVelocityY(-JUMP_VEL);
        }
    }

    async onOverlapped() {
        this.scene.pause();

        this.ui.showLoading();

        try {
            const playedInfo = await submitPlayed(this.score) as any;

            if (!playedInfo.ok) throw new Error('Unsuccessful');

            this.ui.showMain(true, {
                reward: playedInfo.reward,
                achievements: playedInfo.achievements.map((a: string) => achievements[a]),
            });
        } catch (e) {
            console.error(e);

            this.ui.showMain(true, {
                error: 'Could not load your rewards information',
            });
        }

        this.ui.hideLoading();
    }

    update(time: number, delta: number): void {
        this.background.tilePositionX += 1;
        const vel = (this.character.body as Phaser.Physics.Arcade.Body).velocity.y;
        if (vel < -FLAP_THRESH) {
            this.character.setTexture('bird-down');
        } else if (vel > FLAP_THRESH) {
            this.character.setTexture('bird-up');
        } else {
            this.character.setTexture('bird-mid');
        }
        this.columnInterval -= COLUMN_TIME_ACCEL * delta;
        if (time > this.lastColumn + this.columnInterval) {
            this.lastColumn = time;
            this.createColumn();
        }
        this.columnVelocity -= COLUMN_ACCEL * delta;
        this.columnGroup.setVelocityX(this.columnVelocity);
        for (let i = 0; i < this.tracked.length; i++) {
            const t = this.tracked[i];
            if (!t.scored && t.r1.x + PIPE_WIDTH / 2 < (this.character.body as Phaser.Physics.Arcade.Body).x - (this.character.body as Phaser.Physics.Arcade.Body).width / 2) {
                t.scored = true;
                this.score++;
                this.ui.setScore(this.score);
            }
            if (t.r1.x < -PIPE_WIDTH / 2) {
                this.tracked.splice(i, 1);
                i--;
                t.r1.destroy(true);
                t.r2.destroy(true);
            }
        }
    }

    createColumn() {
        const realWidth = this.getRealGameWidth();
        const gapStart = GAP_START + Math.random() * (GAP_END - GAP_START);
        const gapSize = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        const r1 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart - PIPE_HEIGHT / 2, this.ui.getCurrentPipe());
        r1.scale = PIPE_SCALE;
        r1.flipY = true;
        const r2 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart + gapSize + PIPE_HEIGHT / 2, this.ui.getCurrentPipe());
        r2.scale = PIPE_SCALE;
        this.tracked.push({
            r1, r2, scored: false,
        });
        this.columnGroup.add(r1);
        this.columnGroup.add(r2);
    }
}

(window as any).Telegram.WebApp.expand();

const tc = new TonConnectUI({
    manifestUrl: APP_MANIFEST_URL,
});

const game = new Phaser.Game({
    type: Phaser.AUTO,
    height: GAME_HEIGHT,
    width: GAME_WIDTH,
    scene: [new MyScene(new UI(tc))],
    physics: {
        default: 'arcade',
    },
    input: {
        keyboard: true,
    },
    scale: {
        mode: Phaser.Scale.NONE,
        parent: document.body,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
    }
});
// You can install Devtools for PixiJS - https://github.com/bfanger/pixi-inspector#installation
// @ts-ignore
globalThis.__PHASER_GAME__ = game;

const gameUi = new UI(tc);
const connectUiHtml = new ConnectWalletHtmlScene(tc);
const connectUICanvas = new ConnectWalletCanvasScene({
    style: 'light',
    onWalletChange: (wallet) => {
        walletChanged(wallet);
    },
    onError: (error) => {
        console.error('Caught Error', error);
    },
    tonParams: {
        manifestUrl: APP_MANIFEST_URL,
    }
});

function walletChanged(wallet: Wallet | null) {
    if (wallet) {
        connectUiHtml.hide();

        gameUi.transitionToGame();
        gameUi.showMain(false);
        gameUi.showBalance();

        if (CONNECT_UI === 'canvas') {
            if (!game.scene.isActive(ConnectWalletCanvasScene.sceneKey)) {
                game.scene.add(ConnectWalletCanvasScene.sceneKey, connectUICanvas, true);
            }
            connectUICanvas.toRight();
        }
    } else {
        gameUi.transitionOutOfGame();
        gameUi.hideShop();
        gameUi.hideMain();
        gameUi.hideBalance();

        if (CONNECT_UI === 'html') {
            connectUiHtml.show();
        } else {
            if (!game.scene.isActive(ConnectWalletCanvasScene.sceneKey)) {
                game.scene.add(ConnectWalletCanvasScene.sceneKey, connectUICanvas, true);
            }
            connectUICanvas.toCenter();
        }
    }
}

tc.onStatusChange(walletChanged);

restoreWalletConnection({manifestUrl: APP_MANIFEST_URL}).then((wallet) => {
    walletChanged(wallet);
});
