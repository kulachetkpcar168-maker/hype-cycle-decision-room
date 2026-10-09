(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HostKeyGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function shouldRenderKeyPrompt(hostKey,keyFormActive){
    return !hostKey&&!keyFormActive;
  }
  function createRequestGuard(){
    let generation=0;
    return {
      capture(){return generation},
      advance(){generation+=1;return generation},
      isCurrent(snapshot){return snapshot===generation}
    };
  }
  return {shouldRenderKeyPrompt,createRequestGuard};
});
