export const flattern = (array:any[], field:string, item?:any | undefined, parent?: string | undefined) => {
    return array.map((obj:any) => {
        let param = item ? item[obj[field]] || "" : ""
        if(parent) {
            param = obj[parent] || ""
        }

        return Object.entries({[obj[field]]: param})
    }).flat()
}

export const mergeArrays = (arrays:any[]) => {
    return Object.fromEntries(arrays)
}