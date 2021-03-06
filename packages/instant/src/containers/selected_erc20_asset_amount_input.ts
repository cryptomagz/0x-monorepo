import { AssetBuyer, BuyQuote } from '@0x/asset-buyer';
import { AssetProxyId } from '@0x/types';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';
import * as _ from 'lodash';
import * as React from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';

import { Action, actions } from '../redux/actions';
import { State } from '../redux/reducer';
import { ColorOption } from '../style/theme';
import { ERC20Asset, OrderProcessState } from '../types';
import { BigNumberInput } from '../util/big_number_input';
import { errorUtil } from '../util/error';

import { ERC20AssetAmountInput } from '../components/erc20_asset_amount_input';

export interface SelectedERC20AssetAmountInputProps {
    fontColor?: ColorOption;
    startingFontSizePx: number;
}

interface ConnectedState {
    assetBuyer?: AssetBuyer;
    value?: BigNumberInput;
    asset?: ERC20Asset;
}

interface ConnectedDispatch {
    updateBuyQuote: (assetBuyer?: AssetBuyer, value?: BigNumberInput, asset?: ERC20Asset) => void;
}

interface ConnectedProps {
    value?: BigNumberInput;
    asset?: ERC20Asset;
    onChange: (value?: BigNumberInput, asset?: ERC20Asset) => void;
}

type FinalProps = ConnectedProps & SelectedERC20AssetAmountInputProps;

const mapStateToProps = (state: State, _ownProps: SelectedERC20AssetAmountInputProps): ConnectedState => {
    const selectedAsset = state.selectedAsset;
    if (_.isUndefined(selectedAsset) || selectedAsset.metaData.assetProxyId !== AssetProxyId.ERC20) {
        return {
            value: state.selectedAssetAmount,
        };
    }
    return {
        assetBuyer: state.assetBuyer,
        value: state.selectedAssetAmount,
        asset: selectedAsset as ERC20Asset,
    };
};

const updateBuyQuoteAsync = async (
    assetBuyer: AssetBuyer,
    dispatch: Dispatch<Action>,
    asset: ERC20Asset,
    assetAmount: BigNumber,
): Promise<void> => {
    // get a new buy quote.
    const baseUnitValue = Web3Wrapper.toBaseUnitAmount(assetAmount, asset.metaData.decimals);

    // mark quote as pending
    dispatch(actions.setQuoteRequestStatePending());

    let newBuyQuote: BuyQuote | undefined;
    try {
        newBuyQuote = await assetBuyer.getBuyQuoteAsync(asset.assetData, baseUnitValue);
    } catch (error) {
        dispatch(actions.setQuoteRequestStateFailure());
        errorUtil.errorFlasher.flashNewError(dispatch, error);
        return;
    }
    // We have a successful new buy quote
    errorUtil.errorFlasher.clearError(dispatch);
    // invalidate the last buy quote.
    dispatch(actions.updateLatestBuyQuote(newBuyQuote));
};

const debouncedUpdateBuyQuoteAsync = _.debounce(updateBuyQuoteAsync, 200, { trailing: true });

const mapDispatchToProps = (
    dispatch: Dispatch<Action>,
    _ownProps: SelectedERC20AssetAmountInputProps,
): ConnectedDispatch => ({
    updateBuyQuote: (assetBuyer, value, asset) => {
        // Update the input
        dispatch(actions.updateSelectedAssetAmount(value));
        // invalidate the last buy quote.
        dispatch(actions.updateLatestBuyQuote(undefined));
        // reset our buy state
        dispatch(actions.updateBuyOrderState({ processState: OrderProcessState.NONE }));

        if (!_.isUndefined(value) && !_.isUndefined(asset) && !_.isUndefined(assetBuyer)) {
            // even if it's debounced, give them the illusion it's loading
            dispatch(actions.setQuoteRequestStatePending());
            // tslint:disable-next-line:no-floating-promises
            debouncedUpdateBuyQuoteAsync(assetBuyer, dispatch, asset, value);
        }
    },
});

const mergeProps = (
    connectedState: ConnectedState,
    connectedDispatch: ConnectedDispatch,
    ownProps: SelectedERC20AssetAmountInputProps,
): FinalProps => {
    return {
        ...ownProps,
        asset: connectedState.asset,
        value: connectedState.value,
        onChange: (value, asset) => {
            connectedDispatch.updateBuyQuote(connectedState.assetBuyer, value, asset);
        },
    };
};

export const SelectedERC20AssetAmountInput: React.ComponentClass<SelectedERC20AssetAmountInputProps> = connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
)(ERC20AssetAmountInput);
