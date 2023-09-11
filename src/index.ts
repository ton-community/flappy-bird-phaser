import * as Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';

const tc = new TonConnectUI({
    buttonRootId: 'connect',
    manifestUrl: 'https://raw.githubusercontent.com/ton-defi-org/tonconnect-manifest-temp/main/tonconnect-manifest.json',
});

const GAME_HEIGHT = 600;
const GAME_WIDTH = 2400;
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

let firstLaunch = true;

class MyScene extends Phaser.Scene {
    character!: Phaser.GameObjects.Image;
    columnGroup!: Phaser.Physics.Arcade.Group;
    lastJump: number = 0;
    columnVelocity = INITIAL_COLUMN_VELOCITY;
    tracked: { r1: Phaser.GameObjects.Image, r2: Phaser.GameObjects.Image, scored: boolean }[] = [];
    score: number = 0;
    scoreText!: Phaser.GameObjects.Text;
    columnInterval = INITIAL_COLUMN_INTERVAL;
    lastColumn = 0;
    background!: Phaser.GameObjects.TileSprite;

    constructor() {
        super();

        document.getElementById('play')!.addEventListener('click', () => {
            document.getElementById('overlay')!.style.display = 'none';
            document.getElementById('play')!.innerText = 'PLAY AGAIN';
            this.scene.restart();
        });
    }

    getRealGameWidth() {
        return GAME_WIDTH * (this.game.canvas.parentElement!.clientWidth / this.game.canvas.clientWidth);
    }

    preload() {
        this.load.image('pipe', 'assets/pipe-green.png');
        this.load.image('bird-up', 'assets/bluebird-upflap.png');
        this.load.image('bird-down', 'assets/bluebird-downflap.png');
        this.load.image('bird-mid', 'assets/bluebird-midflap.png');
        this.load.image('bg', 'assets/background-day.png');
    }

    create() {
        const realWidth = this.getRealGameWidth();
        this.background = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg');
        this.background.tileScaleX = this.background.tileScaleY = GAME_HEIGHT / BG_HEIGHT;
        this.scoreText = this.add.text(realWidth / 2, GAME_HEIGHT / 12, '0', {
            fontSize: GAME_HEIGHT / 15,
        });
        this.scoreText.setDepth(1000);
        this.scoreText.setOrigin(0.5, 0.5);
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

        if (firstLaunch) {
            firstLaunch = false;
            this.scene.pause();
        }

        this.lastJump = Date.now();
        this.columnVelocity = INITIAL_COLUMN_VELOCITY;
        this.columnInterval = INITIAL_COLUMN_INTERVAL;
        this.tracked = [];
        this.score = 0;
        this.lastColumn = 0;
    }

    onInput() {
        const time = Date.now();
        if (time > this.lastJump + JUMP_COOLDOWN) {
            this.lastJump = time;
            (this.character.body as Phaser.Physics.Arcade.Body).setVelocityY(-JUMP_VEL);
        }
    }

    onOverlapped() {
        const gameOverText = this.add.text(this.getRealGameWidth() / 2, GAME_HEIGHT / 2, 'GAME OVER', {
            fontSize: GAME_HEIGHT / 12,
        });
        gameOverText.setDepth(999);
        gameOverText.setOrigin(0.5, 0.5);
        this.scene.pause();
        document.getElementById('overlay')!.style.display = 'flex';

        fetch('https://flappy.krigga.dev/played', {
            body: JSON.stringify({
                tg_data: (window as any).Telegram.WebApp.initData,
                wallet: tc.account?.address,
                score: this.score,
            }),
            headers: {
                'content-type': 'application/json',
            },
            method: 'POST',
        });
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
                this.scoreText.setText(this.score.toString());
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
        const r1 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart - PIPE_HEIGHT / 2, 'pipe');
        r1.scale = PIPE_SCALE;
        r1.flipY = true;
        const r2 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart + gapSize + PIPE_HEIGHT / 2, 'pipe');
        r2.scale = PIPE_SCALE;
        this.tracked.push({
            r1, r2, scored: false,
        });
        this.columnGroup.add(r1);
        this.columnGroup.add(r2);
    }
}

(window as any).Telegram.WebApp.expand();

let game: Phaser.Game | null = null;

tc.onStatusChange((wallet) => {
    if (game === null && wallet !== null) {
        document.getElementById('connect')!.style.display = 'none';
        document.getElementById('play')!.style.display = 'unset';
        game = new Phaser.Game({
            type: Phaser.AUTO,
            height: GAME_HEIGHT,
            width: GAME_WIDTH,
            scene: new MyScene(),
            physics: {
                default: 'arcade',
            },
            input: {
                keyboard: true,
            },
            scale: {
                mode: Phaser.Scale.HEIGHT_CONTROLS_WIDTH,
                parent: document.body,
                height: GAME_HEIGHT,
                width: GAME_WIDTH,
                autoCenter: Phaser.Scale.CENTER_VERTICALLY,
            }
        });
    }
});
