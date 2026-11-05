export interface AttributeOperation{
    setAttribute(name:string,value:unknown):void
    getAttribute(name:string):unknown
    removeAttribute(name:string):unknown
    allAttribute():Map<string,unknown>
}