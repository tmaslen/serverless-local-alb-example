module.exports.handler = async (event, context, callback) => {

    response = {
        statusCode: 200,
        statusDescription: '200 OK',
        headers: { 
            'Set-cookie': 'cookies', 
            'Content-Type': 'text/html'
        },
        body: '<html><h1>Successfully</h1><p>executed lambda call via loadbalancer</p></html>',
    };
    
    return callback(null, response);
}