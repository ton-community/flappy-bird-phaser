import { buttonDesign } from "./consts";

export interface DropdownMenuItemParams {
    text: string;
    onClick?: (item: DropdownMenuItem) => void;
    backgroundColor: number;
    textColor: string;
}
export class DropdownMenuItem extends Phaser.GameObjects.Container {
    public readonly button: Phaser.GameObjects.Rectangle;
    public readonly text: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number = 0,
        y: number = 0,
        params: DropdownMenuItemParams
    ) {
        super(scene, x, y);

        const text = scene.add.text(
            buttonDesign.dropDownItem.horizontalPadding,
            buttonDesign.dropDownItem.verticalPadding,
            params.text,
            {
                color: params.textColor,
                fontFamily: buttonDesign.fontFamily,
                fontSize: buttonDesign.fontSize,
            }
        );
        this.text = text;

        const textHeight = text.height;

        const buttonWidth = buttonDesign.dropDown.width - (buttonDesign.dropDown.horizontalPadding * 2);
        const buttonHeight = textHeight + (buttonDesign.dropDownItem.verticalPadding * 2);

        const button = scene.add.rectangle(
            0,
            0,
            buttonWidth,
            buttonHeight,
            params.backgroundColor
        );
        button.setOrigin(0, 0);
        this.button = button;

        if (params.onClick) {
            button.setInteractive({ useHandCursor: true });
            button.on('pointerdown', () => {
                params.onClick && params.onClick(this)
            });
        }
        this.add([button, text]);
    }
}


export interface DropdownMenuParams {
    items: {
        text: string;
        onClick?: (item: DropdownMenuItem) => void;
    }[]
    backgroundColor: number;
    textColor: string;
}

export class DropdownMenu extends Phaser.GameObjects.Container {
    constructor(
        scene: Phaser.Scene,
        x: number = 0,
        y: number = 0,
        params: DropdownMenuParams
    ) {
        super(scene, x, y);

        const itemsContainers: DropdownMenuItem[] = [];
        let totalHeight = buttonDesign.dropDown.verticalPadding;
        params.items.forEach((item) => {
            const itemContainer = new DropdownMenuItem(
                scene,
                buttonDesign.dropDown.horizontalPadding,
                totalHeight,
                {...item, backgroundColor: params.backgroundColor, textColor: params.textColor}
            );
            totalHeight += itemContainer.button.height;
            itemsContainers.push(itemContainer);
        });
        totalHeight += buttonDesign.dropDown.verticalPadding;

        const container = scene.add
            .rectangle(
                0,
                0,
                256,
                totalHeight,
                params.backgroundColor
            )
            .setOrigin(0, 0);
        this.add([container, ...itemsContainers]);
    }
}