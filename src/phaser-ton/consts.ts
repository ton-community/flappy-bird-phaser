import { Locale } from "./protocol";

export const buttonDesign = {
    horizontalPadding: 16,
    verticalPadding: 11,
    whiteColor: '#ffffff',
    blackColor: '#000000',
    fontFamily: 'Segoe UI, San Francisco, Roboto, sans-serif',
    fontSize: 15,
    dropDown: {
        topMargin: 12,
        horizontalPadding: 8,
        verticalPadding: 8,
        width: 256,
    },
    dropDownItem: {
        horizontalPadding: 12,
        verticalPadding: 11,
        width: 256,
        height: 40
    }
}

export const locales: { [k: string]: Locale } = {
    en: {
        connectWallet: 'Connect Wallet',
        disconnectWallet: 'Disconnect',
        copyAddress: 'Copy address',
        addressCopied: 'Address copied!',
    },
    ru: {
        connectWallet: 'Подключить кошелёк',
        disconnectWallet: 'Отключить',
        copyAddress: 'Скопировать адрес',
        addressCopied: 'Адрес скопирован!',
    },
};