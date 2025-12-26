import listEndpoints from 'express-list-endpoints';
// TODO Deprecated express 4.x only
export function logEndpoints(app) {
  const endpointsList = listEndpoints(app);

  for (let i = 0; i < endpointsList.length; i++) {
    const method = endpointsList[i].methods[0];
    let color;

    switch (method) {
      case 'GET':
        color = '\x1b[32m';
        break;
      case 'POST':
        color = '\x1b[33m';
        break;
      case 'PATCH':
        color = '\x1b[90m';
        break;
      case 'DELETE':
        color = '\x1b[31m';
        break;
      default:
        color = '\x1b[0m';
        break;
    }

    console.log(
      `[${color}${method.padEnd(6)}\x1b[0m] ${endpointsList[i].path} -- \x1b[2m${endpointsList[i].middlewares}\x1b[0m`
    );
  }
}

export default logEndpoints;
