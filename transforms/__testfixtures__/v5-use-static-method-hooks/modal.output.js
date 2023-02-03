import { Modal, App as AntdApp } from 'antd';

const App = () => {
  const {
    modal,
  } = AntdApp.useApp();
  const onClick1 = () => {
    modal.confirm();
  }
  return <Modal></Modal>;
};
