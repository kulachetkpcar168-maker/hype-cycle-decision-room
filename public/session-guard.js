(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SessionGuard=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function createSessionGuard(){
    let generation=0;
    return {
      capture(){return generation},
      advance(){generation+=1;return generation},
      isCurrent(snapshot){return snapshot===generation}
    };
  }
  return {createSessionGuard};
});
