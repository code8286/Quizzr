export class ApiError extends Error { constructor(message:string,public status:number,public code:string){super(message);} }
export async function api<T>(path:string,data?:unknown):Promise<T>{
  const response=await fetch(`/api/${path}`,{method:data===undefined?"GET":"POST",headers:data===undefined?{}:{"Content-Type":"application/json"},body:data===undefined?undefined:JSON.stringify(data),cache:"no-store"});
  const result=await response.json();if(!response.ok)throw new ApiError(result.message||"Request failed.",response.status,result.code);return result;
}
