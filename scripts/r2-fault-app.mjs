// Kun lokal feilinnsprøyting. Ingen modellnøkkel og ingen utgående modelltrafikk.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const env={...process.env};
for(const line of readFileSync('.env.test.local','utf8').split(/\r?\n/)){
  const m=line.match(/^([A-Z_0-9]+)=(.*)$/);if(m){try{env[m[1]]=JSON.parse(m[2]);}catch{env[m[1]]=m[2];}}
}
if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://evvzxblhaxaraaurbhsu.supabase.co')throw Error('Feil testmiljø');
Object.assign(env,{ANTHROPIC_API_KEY:'synthetic-no-real-key',ANTHROPIC_BASE_URL:'http://127.0.0.1:3016',NEXT_PUBLIC_PILOT:'true',NEXT_PUBLIC_APP_URL:'http://localhost:3015',RESEND_API_KEY:'',CRON_SECRET:''});
const upstream=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  if(raw.includes('R3SYNTHETIC')){
    // Kun loopback-fixture for klient-/transporttest, ikke modellkvalitet.
    const text=JSON.stringify({forklaring:'Syntetisk test.',brevtype:'inkassovarsel',avsender:'R3 test',avsender_epost:'test@example.invalid',brevdato:'2026-11-08',belop:'1288',hovedstol:'1250',saksnummer:'R3-TEST',svar_utfall:'uklart',foreslatte_steg:[],foreslatte_frister:[],kostnadslinjer:[{type:'purregebyr',belop:38,tekst:'Purregebyr 38 kr'}]});
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'r3_fixture',type:'message',role:'assistant',model:'synthetic',content:[{type:'text',text}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}));return;
  }
  // Virkelig hengende lokal forbindelse: ingen headers eller data. Appens
  // eget tidsbudsjett må avbryte; dette er ikke en simulert HTTP 408.
  if(raw.includes('R2FAULT:HANG'))return;
  if(raw.includes('R2FAULT:TIMEOUT')){res.writeHead(408,{'content-type':'application/json'});res.end(JSON.stringify({type:'error',error:{type:'timeout_error',message:'synthetic'}}));return;}
  if(raw.includes('R2FAULT:NETWORK')){req.socket.destroy();return;}
  res.writeHead(200,{'content-type':'text/event-stream'});
  if(raw.includes('R2FAULT:JSON')){res.end('event: message_start\ndata: {invalid-json}\n\n');return;}
  const event=(type,data)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
  event('message_start',{message:{id:'msg_r2',type:'message',role:'assistant',model:'synthetic',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}});
  event('content_block_start',{index:0,content_block:{type:'text',text:''}});
  event('content_block_delta',{index:0,delta:{type:'text_delta',text:'R2 ufullstendig testutkast'}});
  event('content_block_stop',{index:0});
  event('message_delta',{delta:{stop_reason:'max_tokens',stop_sequence:null},usage:{output_tokens:1}});
  event('message_stop',{});res.end();
});
upstream.listen(3016,'127.0.0.1',()=>{
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--port','3015'],{env,stdio:'ignore'});
  console.log('Lokal feilapp startet på 3015; syntetisk modelladapter på loopback 3016.');
  child.on('exit',code=>{upstream.close();process.exitCode=code??1;});
  process.on('SIGINT',()=>{child.kill();upstream.close();});
});
