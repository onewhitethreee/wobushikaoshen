// 进程内排队：同一条队列里的函数依次执行，"先查再写"之间不会被另一个请求插队。每个用途各建一条，互不等待。
// ponytail: 进程内的 Promise 链，只适用于单进程（宪章 V）；改多进程时换 Postgres advisory lock
export const serialQueue = () => {
  let chain: Promise<unknown> = Promise.resolve()
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn)
    chain = run.catch(() => undefined)
    return run
  }
}
