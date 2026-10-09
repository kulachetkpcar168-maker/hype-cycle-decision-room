(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VisibilityPolling=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function createVisibilityPoller(options){
    const documentRef=options.document;
    const setTimeoutFn=options.setTimeoutFn||setTimeout;
    const clearTimeoutFn=options.clearTimeoutFn||clearTimeout;
    let timer=null;
    let stopped=false;
    let generation=0;
    function clear(){if(timer!==null){clearTimeoutFn(timer);timer=null}}
    function schedule(wait,capturedGeneration=generation){clear();if(stopped||documentRef.hidden)return;timer=setTimeoutFn(()=>run(capturedGeneration),wait)}
    function finish(capturedGeneration){if(capturedGeneration===generation)schedule(options.delay(),capturedGeneration)}
    function run(capturedGeneration){const fired=timer;timer=null;if(fired!==null)clearTimeoutFn(fired);if(stopped||documentRef.hidden||capturedGeneration!==generation)return;try{const result=options.refresh();if(result&&typeof result.finally==='function')result.finally(()=>finish(capturedGeneration));else finish(capturedGeneration)}catch(error){finish(capturedGeneration);throw error}}
    function visibility(){generation+=1;if(documentRef.hidden)clear();else schedule(0,generation)}
    return {
      start(){stopped=false;generation+=1;documentRef.addEventListener('visibilitychange',visibility);schedule(0,generation)},
      stop(){stopped=true;generation+=1;clear();documentRef.removeEventListener('visibilitychange',visibility)},
    };
  }
  return {createVisibilityPoller};
});
