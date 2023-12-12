import * as Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { Address, beginCell, toNano } from '@ton/core';
import { getHttpV4Endpoint } from '@orbs-network/ton-access';
import { TonClient4 } from '@ton/ton';
import { ConnectTelegramWalletButton } from './phaser-ton';

const PIPES_AVAILABLE = ['pipe-green', 'pipe-red'];
const PIPES_COSTS = [0, 0.05];
const ENDPOINT = 'http://localhost:3000';
// const ENDPOINT = 'https://flappy.krigga.dev';
const TOKEN_RECIPIENT = 'EQBb7bFnXnKAN1DNO3GPKLXPNiEyi4U6-805Y-aBkgJtK_lJ';
const TOKEN_MASTER = 'EQBcRUiCkgdfnbnKKYhnPXkNi9BXkq_5uLGRuvnwwaZzelit';
const NETWORK = 'testnet';

const SHOP_RELOAD_INTERVAL = 10000;
const BALANCE_RELOAD_INTERVAL = 10000;

class UI {
    scoreDiv: HTMLDivElement = document.getElementById('score') as HTMLDivElement;
    rewardsDiv: HTMLDivElement = document.getElementById('rewards') as HTMLDivElement;
    spinnerDiv: HTMLDivElement = document.getElementById('spinner-container') as HTMLDivElement;
    connectDiv: HTMLDivElement = document.getElementById('connect') as HTMLDivElement;
    skinChooserDiv: HTMLDivElement = document.getElementById('skin-chooser') as HTMLDivElement;
    skinPrevDiv: HTMLDivElement = document.getElementById('skin-prev') as HTMLDivElement;
    skinCurrentDiv: HTMLDivElement = document.getElementById('skin-current') as HTMLDivElement;
    skinImage: HTMLImageElement = document.getElementById('skin-image') as HTMLImageElement;
    skinNextDiv: HTMLDivElement = document.getElementById('skin-next') as HTMLDivElement;
    useButton: HTMLButtonElement = document.getElementById('use') as HTMLButtonElement;
    shopButton: HTMLButtonElement = document.getElementById('shop') as HTMLButtonElement;
    playButton: HTMLButtonElement = document.getElementById('play') as HTMLButtonElement;
    buttonsDiv: HTMLDivElement = document.getElementById('buttons') as HTMLDivElement;
    balanceDiv: HTMLDivElement = document.getElementById('balance') as HTMLDivElement;
    playTextDiv: HTMLDivElement = document.getElementById('play-text') as HTMLDivElement;
    useTextDiv: HTMLDivElement = document.getElementById('use-text') as HTMLDivElement;
    balanceContainerDiv: HTMLDivElement = document.getElementById('balance-container') as HTMLDivElement;
    afterGameDiv: HTMLDivElement = document.getElementById('after-game') as HTMLDivElement;
    errorDiv: HTMLDivElement = document.getElementById('error') as HTMLDivElement;
    tokensAwardedDiv: HTMLDivElement = document.getElementById('tokens-awarded') as HTMLDivElement;
    newAchievementsDiv: HTMLDivElement = document.getElementById('new-achievements') as HTMLDivElement;

    currentPipeIndex = Number(window.localStorage.getItem('chosen-pipe') ?? '0');
    previewPipeIndex = this.currentPipeIndex;

    shopShown = false;

    purchases: { systemName: string }[] = [];

    reloadShopTimeout: any = undefined;

    client: TonClient4 | undefined = undefined;
    jettonWallet: Address | undefined = undefined;

    async redrawBalance() {
        const bal = await this.getBalance();
        this.balanceDiv.innerText = bal.toString();
        this.balanceContainerDiv.style.display = 'block';
        setTimeout(() => this.redrawBalance(), BALANCE_RELOAD_INTERVAL);
    }

    async getBalance() {
        try {
            const client = await this.getClient();
            const jw = await this.getJettonWallet();
            const last = await client.getLastBlock();
            const r = await client.runMethod(last.last.seqno, jw, 'get_wallet_data');
            return r.reader.readBigNumber();
        } catch (e) {
            return BigInt(0);
        }
    }

    async getJettonWallet() {
        if (this.jettonWallet === undefined) {
            const client = await this.getClient();
            if (tc.account === null) {
                throw new Error('No account');
            }
            const lastBlock = await client.getLastBlock();
            const r = await client.runMethod(lastBlock.last.seqno, Address.parse(TOKEN_MASTER), 'get_wallet_address', [{
                type: 'slice',
                cell: beginCell().storeAddress(Address.parse(tc.account.address)).endCell(),
            }]);
            const addrItem = r.result[0];
            if (addrItem.type !== 'slice') throw new Error('Bad type');
            this.jettonWallet = addrItem.cell.beginParse().loadAddress();
        }
        return this.jettonWallet;
    }

    async getClient() {
        if (this.client === undefined) {
            this.client = new TonClient4({
                endpoint: await getHttpV4Endpoint({ network: NETWORK }),
            });
        }
        return this.client;
    }

    async buy(itemId: number) {
        const price = PIPES_COSTS[this.previewPipeIndex];
        await tc.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 3600,
            messages: [
                {
                    address: (await this.getJettonWallet()).toString(),
                    amount: toNano(price).toString(),
                    payload: beginCell().storeUint(0x0f8a7ea5, 32).storeUint(0, 64).storeCoins(price).storeAddress(Address.parse(TOKEN_RECIPIENT)).storeAddress(Address.parse(tc.account!.address)).storeMaybeRef(undefined).storeCoins(1).storeMaybeRef(beginCell().storeUint(0, 32).storeStringTail((window as any).Telegram.WebApp.initDataUnsafe.user.id + ':' + itemId)).endCell().toBoc().toString('base64'),
                },
            ],
        })
    }

    constructor() {
        this.skinPrevDiv.addEventListener('click', () => {
            this.previewPipeIndex--;
            this.redrawShop();
        });
        this.skinNextDiv.addEventListener('click', () => {
            this.previewPipeIndex++;
            this.redrawShop();
        });
        this.useButton.addEventListener('click', () => {
            if (this.previewPipeIndex !== 0 && this.purchases.findIndex(p => p.systemName === this.getPreviewPipe()) === -1) {
                this.buy(this.previewPipeIndex);
                return;
            }
            this.currentPipeIndex = this.previewPipeIndex;
            window.localStorage.setItem('chosen-pipe', this.currentPipeIndex.toString());
            this.redrawShop();
        });
        this.shopButton.addEventListener('click', () => {
            if (this.shopShown) this.hideShop();
            else this.showShop();
        });
        this.connectDiv.addEventListener('click', () => {
            tc.connectWallet();
        });
    }

    showLoading() {
        this.spinnerDiv.style.display = 'unset';
    }

    hideLoading() {
        this.spinnerDiv.style.display = 'none';
    }

    showMain(again: boolean, results?: { reward: 0, achievements: string[] } | { error: string }) {
        if (again) {
            this.playButton.classList.add('button-wide');
            this.playTextDiv.innerText = 'Play again';
        }
        if (results !== undefined) {
            this.afterGameDiv.style.display = 'block';
            if ('error' in results) {
                this.rewardsDiv.style.display = 'none';
                this.errorDiv.innerText = results.error;
                this.errorDiv.style.display = 'block';
            } else {
                this.errorDiv.style.display = 'none';
                this.rewardsDiv.style.display = 'flex';
                this.tokensAwardedDiv.innerText = results.reward.toString();
                if (results.achievements.length > 0) {
                    const achNodes = [results.achievements.length > 1 ? 'New achievements!' : 'New achievement!', ...results.achievements].map(a => {
                        const div = document.createElement('div');
                        div.className = 'flappy-text award-text';
                        div.innerText = a;
                        return div;
                    });
                    this.newAchievementsDiv.replaceChildren(...achNodes);
                } else {
                    this.newAchievementsDiv.replaceChildren();
                }
            }
        }
        this.buttonsDiv.style.display = 'flex';
    }

    hideMain() {
        this.afterGameDiv.style.display = 'none';
        this.buttonsDiv.style.display = 'none';
    }

    getCurrentPipe() {
        return PIPES_AVAILABLE[this.currentPipeIndex];
    }

    getPreviewPipe() {
        return PIPES_AVAILABLE[this.previewPipeIndex];
    }

    redrawShop() {
        this.skinImage.src = 'assets/' + this.getPreviewPipe() + '.png';
        this.skinPrevDiv.style.display = this.previewPipeIndex > 0 ? 'unset' : 'none';
        this.skinNextDiv.style.display = this.previewPipeIndex < PIPES_AVAILABLE.length - 1 ? 'unset' : 'none';
        const bought = this.purchases.findIndex(p => p.systemName === this.getPreviewPipe()) >= 0;
        if (this.previewPipeIndex === this.currentPipeIndex) {
            this.useTextDiv.innerText = 'Used';
            this.useButton.className = 'button-narrow';
        } else if (this.previewPipeIndex === 0 || bought) {
            this.useTextDiv.innerText = 'Use';
            this.useButton.className = 'button-narrow';
        } else {
            this.useTextDiv.innerText = 'Buy for ' + PIPES_COSTS[this.previewPipeIndex];
            this.useButton.className = 'button-narrow button-wide';
        }
    }

    async reloadPurchases() {
        this.reloadShopTimeout = undefined;

        try {
            const purchasesData = await (await fetch(ENDPOINT + '/purchases?auth=' + encodeURIComponent((window as any).Telegram.WebApp.initData))).json();
            if (!this.shopShown) return;
            if (!purchasesData.ok) throw new Error('Unsuccessful');

            this.purchases = purchasesData.purchases;

            this.redrawShop();
        } catch (e) {}

        this.reloadShopTimeout = setTimeout(() => this.reloadPurchases(), SHOP_RELOAD_INTERVAL);
    }

    async showShop() {
        this.afterGameDiv.style.display = 'none';
        this.hideMain();
        this.showLoading();

        try {
            const purchasesData = await (await fetch(ENDPOINT + '/purchases?auth=' + encodeURIComponent((window as any).Telegram.WebApp.initData))).json();
            if (!purchasesData.ok) throw new Error('Unsuccessful');

            this.hideLoading();
            this.showMain(false);

            this.purchases = purchasesData.purchases;
        } catch (e) {
            this.hideLoading();
            this.showMain(false, {
                error: 'Could not load the shop',
            });
            return;
        }

        this.reloadShopTimeout = setTimeout(() => this.reloadPurchases(), SHOP_RELOAD_INTERVAL);

        this.shopShown = true;
        this.skinChooserDiv.style.display = 'flex';
        this.useButton.style.display = 'flex';
        this.previewPipeIndex = this.currentPipeIndex;
        this.redrawShop();
    }

    hideShop() {
        clearTimeout(this.reloadShopTimeout);
        this.reloadShopTimeout = undefined;
        this.shopShown = false;
        this.skinChooserDiv.style.display = 'none';
        this.useButton.style.display = 'none';
        this.afterGameDiv.style.display = 'block';
    }

    setScore(score: number) {
        this.scoreDiv.innerText = score.toString();
    }

    onPlayClicked(fn: () => void) {
        this.playButton.addEventListener('click', fn);
    }

    transitionToGame() {
        this.connectDiv.style.display = 'none';
        this.scoreDiv.style.display = 'inline-block';
        this.buttonsDiv.style.display = 'flex';
    }
}

const ui = new UI();

const tc = new TonConnectUI({
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

class UiScene extends Phaser.Scene {
    button!: ConnectTelegramWalletButton;

    constructor() {
        super({ key: 'UiScene', active: true });
    }

    create() {
        this.button = new ConnectTelegramWalletButton(
            this,
            16,
            40,
            {
                style: 'light',
                onWalletChange: (wallet) => {
                    console.info('Wallet changed', wallet);
                },
                onError: (error) => {
                    console.error('Caught Error', error);
                },
                appManifestUrl: 'https://raw.githubusercontent.com/ton-defi-org/tonconnect-manifest-temp/main/tonconnect-manifest.json',
            }
        );
    }
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

    constructor() {
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
        ui.setScore(this.score);
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

        ui.showLoading();

        try {
            const playedInfo = await submitPlayed(this.score) as any;

            if (!playedInfo.ok) throw new Error('Unsuccessful');

            ui.showMain(true, {
                reward: playedInfo.reward,
                achievements: playedInfo.achievements.map((a: string) => achievements[a]),
            });
        } catch (e) {
            console.error(e);

            ui.showMain(true, {
                error: 'Could not load your rewards information',
            });
        }

        ui.hideLoading();
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
                ui.setScore(this.score);
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
        const r1 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart - PIPE_HEIGHT / 2, ui.getCurrentPipe());
        r1.scale = PIPE_SCALE;
        r1.flipY = true;
        const r2 = this.add.image(realWidth + PIPE_WIDTH / 2, gapStart + gapSize + PIPE_HEIGHT / 2, ui.getCurrentPipe());
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
        ui.transitionToGame();
        ui.showMain(false);
        ui.redrawBalance();
        game = new Phaser.Game({
            type: Phaser.AUTO,
            height: GAME_HEIGHT,
            width: GAME_WIDTH,
            scene: [new MyScene(), new UiScene()],
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

        // You can install Devtools for PixiJS - https://github.com/bfanger/pixi-inspector#installation
        // @ts-ignore
        globalThis.__PHASER_GAME__ = game;
    }
});
