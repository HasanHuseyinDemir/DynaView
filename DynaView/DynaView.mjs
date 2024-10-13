const o = new MutationObserver((M)=>{
    M.forEach((m)=>{
        if (m.type=="childList"){
            m.removedNodes.forEach((r)=>{
                collect(r).forEach(e=>{
                    if(e[g.cleanup]){
                        e[g.cleanup]()
                    }
                })
            });
            m.addedNodes.forEach((a)=>{
                collect(a).forEach(e=>{
                    if(e[g.append]){
                        e[g.append]()
                    }
                })
            });
        }
    });
});
o.observe(document.body,{childList:true,subtree:true});

function isImmut(c){
    return typeof c=="string"||typeof c=="number"
}
function isObj(c){//pure object
    if(c){return Object.getPrototypeOf(c)==Object.prototype}
}

function destroy(o){
    for(let val in o){
        let t=o[val]
        if(t&&isObj(t)){destroy(t)}
        else if(t instanceof Map){t.forEach((v,k)=>{destroy(v);t.delete(k);})}
        else if(t instanceof Set){t.forEach(v=>{destroy(v)});t.clear()}
        else if(Array.isArray(t)){t.forEach(v=>{destroy(v)})}
        delete o[val]
    }
}
function collect(e){
    const ns = [];
    function t(n) {
        if (n.nodeType==1||n.nodeType==3) {ns.push(n)}
        if(n.childNodes){
            n.childNodes.forEach(c=>t(c));
        }
    }
    t(e);
    return [...new Set(ns)];
}

let effectIndex=new Map()
let signalIndex=new Map()

let a=(t,...c) => {
    let e
    if(t=="t"||t=="text"||t=="textnode"){return new Text(c[0])
    }else if(t=="f"||t=="frag"||t=="fragment"){e=document.createDocumentFragment()
    }else{e=document.createElement(t);}
    let v=[]
    c.forEach(E=>{
        if(E!=undefined&&E!=null){
            if(isImmut(E)){
                v.push(document.createTextNode(E))
            }else if(E instanceof Node){
                v.push(E)
            }else if(typeof E=="function"){
                v.push(Render(E))
            }
        }
    })
    v.forEach(y=>{e.appendChild(y)})
    c=null
    v=null
    return e;
};

const A=new Proxy({},{
    get: (_,t) => (...i) =>a(t.toLowerCase(),...i)
});

HTMLElement.prototype.destroy=function(){this.outerHTML=null}

function rem(e,f){setTimeout(()=>{if(typeof e.destroy=="function"){e.destroy()};e.remove();e=null;f();f=null},3000)}
function wrap(f,index,...args){
    return function(){
        f()
        let x=effectIndex.get(index)
        if(x){
            x(...args)
        }
    }
}

HTMLElement.prototype.send=function(b){
    let index=this[g.index]
    if(index!=undefined&&signalIndex.has(index)){
        let a=signalIndex.get(index)
        a({from:this,signal:b})
        a=null
    }
    index=null
}

function b(t,...c){
    let data={},e
    c.forEach((x,i)=>{if(isObj(x)){data={...x};delete c[i]}})
    e=A[t](...c)
    let eventListeners,stateFunctions,activeWatchers
    eventListeners=new Map()
    stateFunctions=new Set()
    activeWatchers=new Set()
    if (data&&Object.keys(data).length) {
        for (let k in data) {//k = KEY
            if(k=="use"){
                data[k].call(e)
            }else if(k=="sync"){
                stateFunctions.add(data[k].bind(e))
            }else if (k.startsWith("on")) {
                let s=k.slice(2).toLowerCase()
                eventListeners.set(s,data[k].bind(e));
                e.addEventListener(s,eventListeners.get(s));
                s=null
            }else if(typeof data[k]=="function"){
                stateFunctions.add(wrap($S(e,k,data[k]),global.RenderINDEX,{method:"property",key:k,element:e}))
            }else if(k=="style"){
                if(typeof data[k]=="string"){
                    e[k]=data[k]
                }else if(typeof data[k]=="function"){
                    stateFunctions.add(wrap($S(e,"style",data[k]),global.RenderINDEX,{method:"style",key:k,element:e}))
                }else if(isObj(data[k])){
                    let t=data[k]//{color:"red",backgroundColor(){return "orange"}}
                    for(let s in t){
                        if(typeof t[s]=="function"){
                            stateFunctions.add(wrap(()=>$CS(e,s,t[s]()),global.RenderINDEX,{method:"style",key:k,element:e}))
                        }else{
                            e.style[s]=t[s]
                        }
                    }
                    t=null
                }
            }else{
                if(elementProperties.includes(k)){
                    e[k]=data[k]
                }else{
                    e.setAttribute(k,data[k])
                }
            }
        }
    }
    let settings={
        memo:global.memo,//silinip silinmeyeceği
        evented:Boolean(eventListeners.size),
        hooks:{},
        states:[],
        index:global.RenderINDEX,
        append(){
                if(!settings.evented){
                    eventListeners.forEach((v,k)=>{e.addEventListener(k,v)})
                    settings.evented=true
                }
                if(!Boolean(activeWatchers.size)){
                    stateFunctions.forEach(x=>{
                        activeWatchers.add(watch(x))
                    })
                }
        },
        //Soft  -|TEMPORARY|- Cleaning Functions
        clear(){
                if(settings.evented){eventListeners.forEach((v,k)=>{e.removeEventListener(k,v)});settings.evented=false}
                activeWatchers.forEach(x=>{if(x){x.remove()}})
                activeWatchers.clear()
        },
        //Robust-|PERMANENT|- Cleaning Functions
        delete(){
                if(effectIndex.has(settings.index)){effectIndex.delete(settings.index)}
                if(signalIndex.has(settings.index)){signalIndex.delete(settings.index)}
                settings.clear()
                destroy(eventListeners);
                eventListeners=null
                activeWatchers.forEach(x=>{destroy(x)})
                destroy(activeWatchers)
                activeWatchers=null
                destroy(settings.hooks);settings.hooks=null
                settings.states.forEach(state=>{if(state&&state.kill){state.kill()}})
        },
    }

    e[g.index]=settings.index

    function memoize(v,a){
        settings.memo=Boolean(v)
        if(!a){
            collect(e).forEach(X=>{
                X[g.memo](settings.memo)
            })
        }
    }
    function cleanup(force){
        if(settings.hooks&&settings.hooks.onRemove){
            settings.hooks.onRemove.call(e)
        }
        if(!settings.memo||force){
            //robust!
            e[g.cleanup]=null
            let cl=collect(e)
            let removed=[]
            cl.forEach(x=>{
                if(x[g.index]==settings.index){
                    x.remove()
                    removed.push(x)
                }
            })
            cl.forEach(z=>{if(z[g.cleanup]){z[g.cleanup](force)}})
            rem(e,()=>e=null)
            cl=null
            destroy(removed)
            removed=null
            settings.delete()
            destroy(settings)
            delete e[g.memo]
            delete e[g.append]
            delete e[g.setHooks]
            delete e[g.index]
            settings=null
            memoize=null
            append=null
            setHooks=null
            cleanup=null//en son olmalı!
        }else{
            //just clean
            settings.clear()
        }
    }

    function append(){
        if(settings.hooks&&settings.hooks.onConnect){
            settings.hooks.onConnect.call(e)
        }
        settings.append()
    }

    function setHooks(){
        let t=global.TempHooks
        let last=t[t.length-1]
        let w=global.TempWatchers
        let lastW=w[w.length-1]
        let s=global.states
        let lastS=s[s.length-1]
        if(last){
            settings.hooks=t.pop()
            if(settings.hooks.onEffect){
                effectIndex.set(settings.index,settings.hooks.onEffect)
            }
            if(settings.hooks.onSignal){
                signalIndex.set(settings.index,settings.hooks.onSignal)
            }
        }
        if(lastW){
            let pop=w.pop()
            pop.forEach((W)=>{stateFunctions.add(W)})
        }
        if(lastS){
            settings.states=s.pop()
        }
        lastW=null
        w=null
        lastS=null
        s=null
        last=null
        t=null
    }

    e[g.setHooks]=setHooks
    e[g.cleanup]=cleanup
    e[g.memo]=memoize
    e[g.append]=append
    return e
}
const B=new Proxy({},{
    get:(_,t)=>(...x)=>b(t,...x)
})


const global={
    symbols:{
        memo:Symbol(),
        cleanup:Symbol(),
        append:Symbol(),
        setHooks:Symbol(),
        index:Symbol(),
    },
    memo:false,
    TempHooks:[],
    TempWatchers:[],
    states:[],
    state:"IDLE"
}
let g=global.symbols// #shorthand
function Cleanup(e,force){
    let t=g.cleanup
    if(e[t]){
        e[t](force)
    }
}

let RenderINDEX=0
function Render(f){
    global.state="RECORD"
    global.RenderINDEX=RenderINDEX++
    global.states.push([])
    global.TempHooks.push({})
    global.TempWatchers.push([])
    let res=f()
    if(res[g.setHooks]){
        res[g.setHooks]()
    }else{
        let S=global.states.pop()
        let s=global.TempHooks.pop()
        let w=global.TempWatchers.pop()
        if(S.length||Object.keys(w).length||Object.keys(s).length){console.warn("DynaView Component-Scope Warning:\nThis component uses hooks and state management, but the first element is not a suitable HTML element. This may lead to memory leaks. Please ensure the first element is a valid one.")}
        S.forEach(v=>v.kill())
        s=null
        w=null
    }
    global.state="IDLE"
    return res
}

function Memo(f){
    global.memo=true
    let res=Render(f)
    global.memo=false
    return res
}

function Remember(e,a){
    collect(e).forEach(E=>{
        if(E[g.memo]){
            E[g.memo](a??true,true)
        }
    })
    return e
}

const elementProperties = ["innerText","inner","textContent","className","nodeValue","style","innerHTML","outerHTML","dataset","contentEditable","draggable","checked","disabled","required","value","alt","role"];
function $S(E,A,V){
    //returns function
    if(elementProperties.includes(A)){return ()=>$CV(E,A,V())}
    return ()=>$CA(E,A,V())
}

function $CA(e,a,v){
    let b=e.getAttribute(a)
    if(b!==v){
        e.setAttribute(a,v)
    }
}
//CHANGESTYLE
function $CS(e,a,v){
    let b=e.style[a]
    if(b!==v){
        e.style[a]=v
    }
}
//CHANGEVALUE
function $CV(e,a,v){
    let b=e[a]
    if(b!==v){
    e[a]=v
}
}

let StateContext=[]
function createState(i){
    let set=new Set()
    let data={
        initial:i,
        get(){
            if(StateContext.length){
                StateContext[StateContext.length-1].add(set)
            }
            return data.initial
        },
        set(a){
            let before=data.initial
            let diff=before!==a
            data.initial=a
            if(diff){
                set.forEach((e)=>e({before,current:data.initial}))
            }
            return a
        }
    }

    function s(a){
        if(a!==undefined){
            let res=typeof a=="function"?a(data.initial):a
            return data.set(res)
        }
        a=null
        if(data){
            return data.get()
        }
    }
    s.kill=function(){
        destroy({set,data})
        set=null
        data=null
        s.kill=null
        s=null
    }
    if(global.state=="RECORD"){
        global.states[global.states.length-1].push(s)
    }
    return s
}

function createReducer(i,f){
    let state=createState(i)
    let kill
    function dispatch(a,...args){
        if(a!==undefined){
            let res=f(state(),a,...args)
            if(res!=undefined){
                return state(res)
            }
        }else{
            return state()
        }
    }
    dispatch.kill=()=>{
        kill=null
        state=null;
        dispatch=null
    }
    kill=state.kill
    state.kill=()=>{
        kill()
        dispatch.kill()
    }
    return dispatch
}
function createComputed(f){
    let state=createState(1)
    let watcher=watch(()=>{state(f())})
    let kill=state.kill

    state.kill=()=>{
        watcher.kill()
        kill()
        kill=null
        state=null
        watcher=null
        f=null
    }
    return state
}


function watch(f){
    StateContext.push(new Set())
    let res=f()
    let kl=StateContext.pop()
    if(kl.size==0){return res}
    res=null

    let settings={
        append(){kl.forEach(v=>{v.add(f)})},
        remove(){kl.forEach(v=>{v.delete(f)})},
        kill(){
            settings.remove()
            while(kl.length){kl.pop()}
            kl=null
            destroy(settings)
            f=null
        },
        trigger:f
    }
    settings.append()//init
    return settings
}
function Watch(f){
    let t=global.TempWatchers
    let last=t[t.length-1]
    if(global.state=="RECORD"){
        last.push(f)
    }else{
        console.warn(`DynaView WATCH Warn:\nThis hook must be in a component scope! Use 'watch' instead of 'Watch' in non-component contexts.`);
        return watch(f)
    }
    t=null
    last=null
}

const hooksGen=new Proxy({},{
    get(_,a){return function(f){
        let t=global.TempHooks
        let last=t[t.length-1]
        if(global.state=="RECORD"){
            if(last[a]){
                console.warn(`DynaView HookSet-${a.toUpperCase()} Warn:\n${a} hook already set!`)
            }
            last[a]=f
        }else{
            console.warn(`DynaView HookSet-${a.toUpperCase()} Warn:\nThis hook must be in a component scope!`)
        }
        f=null
        t=null
        last=null
    }}
})

function Switch(f) {
    let result=createState(new Text())
    watch(()=>{
        let p=result()
        result(Render(f))
        p.replaceWith(Remember(result()))
        Cleanup(p)
        p=null
    })
    return result()
}

const {onConnect,onRemove,onEffect,onSignal}=hooksGen

function Mount(to,eoC,...args){
    let target,res,error
    typeof to=="string"?target=document.querySelector(to):to instanceof HTMLElement?target=to:(error+=" target must be a HTMLELEMENT -")
    typeof eoC=="function"?res=Render(()=>eoC(...args)):eoC instanceof HTMLElement?res=eoC:(error+=" output must be a HTMLELEMENT -")
    if(error){
        console.error("DynaView Mount Error:\n"+error)
    }else{
        target.appendChild(res)
    }
}
export {B as Elements,A,Mount,onConnect,onRemove,onEffect,onSignal,Watch,watch,createComputed,createReducer,createState,Remember,Memo,Render,Cleanup,Switch}
