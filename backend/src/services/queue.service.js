function testQueue() {
  const queue = [
    { token: 'T-12', status: 'Waiting', position: 1, tokenType: 'normal' },
    { token: 'T-13', status: 'Waiting', position: 2, tokenType: 'normal' },
  ];

  console.log('Queue order:', queue.map((booking) => booking.token).join(' -> '));
  return queue;
}

module.exports = { testQueue };