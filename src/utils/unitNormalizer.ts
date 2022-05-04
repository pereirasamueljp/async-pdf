export const unitNormalizerToPT = (unit?: 'pt' | 'px' | 'in' | 'cm' | 'em' | 'mm' | 'ex' | 'pc', value?: number): number => {
    if(!value) return 0;
    switch (unit) {
        case 'pt': return value;
        case 'px': return parseFloat((value * 0.75).toFixed(2));
        case 'in': return parseFloat((value * 72).toFixed(2));
        case 'cm': return parseFloat((value * 28.3465).toFixed(2));
        case 'em': return parseFloat((value * 0.0836).toFixed(2));
        case 'mm': return parseFloat((value * 2.83465).toFixed(2));
        case 'ex': return parseFloat((value * 4.30554).toFixed(2));
        case 'pc': return parseFloat((value * 12).toFixed(2));
        default: return value;
    }
}

export const unitNormalizerFromPT = (unit?: 'pt' | 'px' | 'in' | 'cm' | 'em' | 'mm' | 'ex' | 'pc', value?: number): number => {
    if(!value) return 0;
    switch (unit) {
        case 'pt': return value;
        case 'px': return parseFloat((value * 1.3333333333333333).toFixed(2));
        case 'in': return parseFloat((value * 0.013888888888888888).toFixed(2));
        case 'cm': return parseFloat((value * 0.0352778).toFixed(2));
        case 'em': return parseFloat((value * 0.0836).toFixed(2));
        case 'mm': return parseFloat((value * 0.352778).toFixed(2));
        case 'ex': return parseFloat((value * 0.23255).toFixed(2));
        case 'pc': return parseFloat((value * 0.08333).toFixed(2));
        default: return value;
    }
}