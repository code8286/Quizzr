import type { Paper } from "../src/server/model";
// Synthetic practice content, imported by setup tooling only. Never import in client code.
const content = [
  ["Find the determinant of $\\begin{pmatrix}3&1\\\\2&4\\end{pmatrix}$.","10","For a 2 × 2 matrix, use ad − bc."],
  ["Evaluate $\\frac{d}{dx}(x^3)$ at $x=2$.","12","The derivative of x³ is 3x²."],
  ["Evaluate $\\int_0^2 3x^2\\,dx$.","8","An antiderivative of 3x² is x³."],
  ["A fair die is rolled 12 times. What is the expected number of sixes?","2","Multiply the number of rolls by the probability of a six."],
  ["Solve $2x+6=20$. Enter the value of $x$.","7","First subtract 6 from both sides."],
  ["Find the trace of $\\begin{pmatrix}5&2\\\\1&4\\end{pmatrix}$.","9","Add the diagonal entries."],
  ["Evaluate $\\frac{d}{dx}(x^2+4x)$ at $x=3$.","10","Differentiate to obtain 2x + 4."],
  ["Evaluate $\\int_0^3 2x\\,dx$.","9","An antiderivative of 2x is x²."],
  ["A fair coin is tossed 20 times. What is the expected number of heads?","10","The probability of heads is one half."],
  ["Solve $3x-5=16$. Enter the value of $x$.","7","Add 5 to both sides before dividing."],
  ["Find the determinant of $\\begin{pmatrix}4&0\\\\2&3\\end{pmatrix}$.","12","A triangular matrix's determinant is the product of its diagonal entries."],
  ["Evaluate $\\frac{d}{dx}(2x^2)$ at $x=4$.","16","Differentiate to obtain 4x."],
  ["Evaluate $\\int_0^2 4x\\,dx$.","8","An antiderivative is 2x²."],
  ["A bag contains 3 red and 2 blue balls. In 10 independent draws with replacement, how many red balls are expected?","6","The probability of red is 3/5."],
  ["Solve $5x+4=49$. Enter the value of $x$.","9","Subtract 4, then divide by 5."],
];
export const practicePapers:Paper[]=content.map(([text,key,hint],i)=>({id:`practice-${Math.floor(i/5)+1}-${i%5+1}`,set:Math.floor(i/5)+1,module:i%5+1,text,key,version:"practice-v1",hints:[{text:hint,deduction:0.5}]}));
