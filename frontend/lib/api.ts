export async function getHealth() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
  return res.json();
}

