// 这个文件的所有导出都是未使用的
export const fetchData = async url => {
  const response = await fetch(url);
  return response.json();
};

export const postData = async (url, data) => {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
};

export const unusedApiCall = () => {
  console.log('This API is never used');
};
